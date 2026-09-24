-- Operations: search indexes, verified-email sync, seller enquiry status,
-- notification delivery queue, maintenance job and admin analytics.

------------------------------------------------------------------------------
-- Search indexes
------------------------------------------------------------------------------

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Keyword search on titles (public search and admin property search) and
-- admin user search by name. Trigram GIN keeps `ilike '%term%'` off a full scan.
create index if not exists properties_title_trgm_idx on public.properties using gin (title extensions.gin_trgm_ops);
create index if not exists profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- Time-bucketed admin analytics and admin lists.
create index if not exists properties_created_idx on public.properties (created_at desc, id desc);
create index if not exists enquiries_created_idx on public.enquiries (created_at);
create index if not exists property_status_history_action_idx on public.property_status_history (action, created_at);
create index if not exists profiles_created_idx on public.profiles (created_at desc, id desc);

------------------------------------------------------------------------------
-- Verified email sync (GAP-07): profiles.email only ever holds an address
-- Supabase Auth has confirmed. Phone-first accounts may have none.
------------------------------------------------------------------------------

create or replace function app.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.provision_profile(new.id, new.phone);
  elsif new.phone is distinct from old.phone then
    update public.profiles set phone = app.e164(new.phone) where id = new.id;
  end if;
  if tg_op = 'INSERT'
     or (new.email, new.email_confirmed_at) is distinct from (old.email, old.email_confirmed_at) then
    update public.profiles
       set email = case when new.email_confirmed_at is not null then nullif(btrim(new.email), '') end
     where id = new.id;
  end if;
  return null;
end;
$$;

create trigger on_auth_user_email_changed after update of email, email_confirmed_at on auth.users
  for each row execute function app.handle_auth_user_change();

------------------------------------------------------------------------------
-- Seller enquiry inbox (GAP-08 PROPOSED: new -> read -> closed, seller only)
------------------------------------------------------------------------------

create or replace function public.update_enquiry_status(p_enquiry_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_enquiry public.enquiries%rowtype;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  if not app.actor_is_active(v_actor) then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;
  if p_status is null or p_status not in ('read', 'closed') then
    perform app.fail('VALIDATION_FAILED', 'status');
  end if;
  select * into v_enquiry from public.enquiries where id = p_enquiry_id for update;
  if not found or v_enquiry.seller_id <> v_actor then
    perform app.fail('ENQUIRY_NOT_FOUND');
  end if;
  if v_enquiry.status = p_status or (v_enquiry.status = 'closed') then
    return jsonb_build_object('enquiry_id', v_enquiry.id, 'status', v_enquiry.status, 'changed', false);
  end if;
  update public.enquiries set status = p_status where id = v_enquiry.id;
  return jsonb_build_object('enquiry_id', v_enquiry.id, 'status', p_status, 'changed', true);
end;
$$;

------------------------------------------------------------------------------
-- Notification delivery queue (GAP-12): bounded batches, leases, backoff.
------------------------------------------------------------------------------

create index if not exists notification_intents_stale_idx on public.notification_intents (locked_until) where status = 'processing';

create or replace function public.claim_notification_intents(p_limit integer, p_lease_seconds integer)
returns setof public.notification_intents
language sql
security definer
set search_path = ''
as $$
  with due as (
    select n.id from public.notification_intents n
    where (n.status in ('pending', 'failed') and n.next_attempt_at <= now())
       or (n.status = 'processing' and n.locked_until < now())
    order by n.next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  update public.notification_intents n
     set status = 'processing',
         locked_until = now() + make_interval(secs => p_lease_seconds),
         attempts = n.attempts + 1
    from due
   where n.id = due.id
  returning n.*
$$;

-- p_outcome: 'sent' | 'skipped' (nothing to deliver) | 'failed' (retry with
-- quadratic backoff; abandoned after 5 attempts).
create or replace function public.complete_notification_intent(p_id uuid, p_outcome text, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_intents
     set status = case
                    when p_outcome = 'sent' then 'sent'
                    when p_outcome = 'skipped' then 'cancelled'
                    when attempts >= 5 then 'cancelled'
                    else 'failed'
                  end,
         next_attempt_at = case
                             when p_outcome = 'failed' then now() + make_interval(mins => attempts * attempts)
                             else next_attempt_at
                           end,
         locked_until = null,
         last_error = left(p_error, 500)
   where id = p_id and status = 'processing'
$$;

------------------------------------------------------------------------------
-- Maintenance (GAP-27): bounded, idempotent, safe to run concurrently.
-- Returns expired quarantine objects so the caller can delete the bytes.
------------------------------------------------------------------------------

create or replace function public.run_maintenance(p_batch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch integer := least(greatest(p_batch, 1), 1000);
  v_expired jsonb;
  v_rate_limits integer;
  v_receipts integer;
begin
  with expired as (
    select s.id from app.upload_sessions s
    where s.state in ('initiated', 'processing') and s.expires_at < now()
    order by s.expires_at
    limit v_batch
    for update skip locked
  ), marked as (
    update app.upload_sessions s
       set state = 'failed', error_code = 'expired', lease_token = null, lease_until = null
      from expired
     where s.id = expired.id
    returning s.bucket, s.quarantine_key
  )
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'key', quarantine_key)), '[]'::jsonb)
    into v_expired from marked;

  delete from app.rate_limits
   where key in (select r.key from app.rate_limits r
                  where r.window_start < now() - interval '2 days' limit v_batch);
  get diagnostics v_rate_limits = row_count;

  delete from app.webhook_receipts w
   where (w.source, w.id) in (select r.source, r.id from app.webhook_receipts r
                               where r.received_at < now() - interval '2 days' limit v_batch);
  get diagnostics v_receipts = row_count;

  return jsonb_build_object('expired_uploads', v_expired,
                            'rate_limits_deleted', v_rate_limits,
                            'webhook_receipts_deleted', v_receipts);
end;
$$;

------------------------------------------------------------------------------
-- Admin analytics (design §20, GAP-16). One GROUP BY per source, joined onto
-- the bucket series; the caller-controlled range is capped so cost never
-- scales with an arbitrary date-picker width. Reporting timezone: IST.
------------------------------------------------------------------------------

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.require_admin_actor();
  v_today timestamptz := date_trunc('day', now(), 'Asia/Kolkata');
begin
  return jsonb_build_object(
    'status_counts', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select p.status, count(*) as n from public.properties p where p.deleted_at is null group by p.status) s),
    'listed', (select count(*) from public.properties p where p.is_listed),
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where not pr.is_suspended and pr.deleted_at is null),
        'suspended', count(*) filter (where pr.is_suspended))
      from public.profiles pr),
    'enquiries', (
      select jsonb_build_object('total', count(*), 'today', count(*) filter (where e.created_at >= v_today))
      from public.enquiries e),
    'by_location', (
      select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'count', c.n) order by c.n desc, l.name), '[]'::jsonb)
      from (select p.location_id, count(*) as n from public.properties p
             where p.is_listed group by p.location_id order by n desc limit 12) c
      join public.locations l on l.id = c.location_id),
    'by_type', (
      select coalesce(jsonb_agg(jsonb_build_object('type', t.property_type, 'count', t.n) order by t.n desc), '[]'::jsonb)
      from (select p.property_type, count(*) as n from public.properties p
             where p.is_listed group by p.property_type) t),
    'funnel_90d', (
      select jsonb_build_object(
        'submitted', count(distinct h.property_id) filter (where h.action = 'submit'),
        'reviewed', count(distinct h.property_id) filter (where h.action = 'begin_review'),
        'approved', count(distinct h.property_id) filter (where h.action = 'approve'),
        'enquired', (select count(distinct e.property_id) from public.enquiries e
                      where e.created_at >= now() - interval '90 days'))
      from public.property_status_history h
      where h.action in ('submit', 'begin_review', 'approve')
        and h.created_at >= now() - interval '90 days'));
end;
$$;

create or replace function public.admin_trend(p_metric text, p_bucket text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.require_admin_actor();
  v_max_days integer;
  v_result jsonb;
begin
  if p_metric not in ('listings_created', 'listings_approved', 'enquiries')
     or p_bucket not in ('day', 'week', 'month')
     or p_from is null or p_to is null or p_from > p_to then
    perform app.fail('VALIDATION_FAILED', 'range');
  end if;
  v_max_days := case p_bucket when 'day' then 366 when 'week' then 1098 else 1830 end;
  if p_to - p_from > v_max_days then
    perform app.fail('VALIDATION_FAILED', 'range_too_wide');
  end if;

  with series as (
    select generate_series(date_trunc(p_bucket, p_from::timestamp),
                           date_trunc(p_bucket, p_to::timestamp),
                           ('1 ' || p_bucket)::interval) as bucket
  ), events as (
    select p.created_at from public.properties p where p_metric = 'listings_created'
    union all
    select h.created_at from public.property_status_history h
     where p_metric = 'listings_approved' and h.action = 'approve'
    union all
    select e.created_at from public.enquiries e where p_metric = 'enquiries'
  ), counts as (
    select date_trunc(p_bucket, ev.created_at at time zone 'Asia/Kolkata') as bucket, count(*) as n
    from events ev
    where ev.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata')
      and ev.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
    group by 1
  )
  select jsonb_agg(jsonb_build_object('bucket', to_char(s.bucket, 'YYYY-MM-DD'), 'count', coalesce(c.n, 0))
                   order by s.bucket)
    into v_result
    from series s left join counts c on c.bucket = s.bucket;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

------------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------------

revoke all on function
  public.update_enquiry_status(uuid, text),
  public.claim_notification_intents(integer, integer),
  public.complete_notification_intent(uuid, text, text),
  public.run_maintenance(integer),
  public.admin_dashboard_summary(),
  public.admin_trend(text, text, date, date)
from public, anon, authenticated;

grant execute on function
  public.update_enquiry_status(uuid, text),
  public.admin_dashboard_summary(),
  public.admin_trend(text, text, date, date)
to authenticated;

grant execute on function
  public.claim_notification_intents(integer, integer),
  public.complete_notification_intent(uuid, text, text),
  public.run_maintenance(integer)
to service_role;

revoke all on function app.handle_auth_user_change() from public, anon, authenticated, service_role;
