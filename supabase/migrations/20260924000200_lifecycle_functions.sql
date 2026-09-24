-- Business operations that must be atomic and authoritative in the database.
--
-- Two calling conventions:
--   * `auth.uid()` functions are executed with the user's own JWT (server
--     actions use the cookie-bound client), so the database — not only the
--     Next.js layer — decides who the actor is.
--   * `p_actor_id` functions are executable by service_role only. Next.js calls
--     them after verifying the session, for steps the user must never be able
--     to trigger directly (e.g. declaring that uploaded bytes were validated).
--     They still re-check the actor's current state, ownership and listing state.

------------------------------------------------------------------------------
-- Rate limiting (GAP-17): atomic fixed-window counter shared by all instances.
------------------------------------------------------------------------------

create or replace function app.rate_limit_consume(
  p_action text, p_subject text,
  out allowed boolean, out retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy app.rate_limit_policies%rowtype;
  v_window interval;
  v_row app.rate_limits%rowtype;
begin
  select * into v_policy from app.rate_limit_policies where action = p_action;
  if not found then
    raise exception 'unknown rate limit action %', p_action;
  end if;
  v_window := make_interval(secs => v_policy.window_seconds);

  insert into app.rate_limits as rl (key, window_start, hits)
  values (encode(sha256(convert_to(p_action || ':' || coalesce(p_subject, ''), 'UTF8')), 'hex'), now(), 1)
  on conflict (key) do update set
    hits = case when rl.window_start <= now() - v_window then 1 else rl.hits + 1 end,
    window_start = case when rl.window_start <= now() - v_window then now() else rl.window_start end
  returning * into v_row;

  allowed := v_row.hits <= v_policy.max_hits;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (v_row.window_start + v_window - now())))::integer)
  end;
end;
$$;

create or replace function public.consume_rate_limit(p_action text, p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
begin
  select * into v_result from app.rate_limit_consume(p_action, p_subject);
  return jsonb_build_object('allowed', v_result.allowed, 'retry_after_seconds', v_result.retry_after_seconds);
end;
$$;

-- Returns true the first time a (source, id) pair is seen.
create or replace function public.register_webhook_receipt(p_source text, p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into app.webhook_receipts (source, id) values (p_source, p_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

-- Forgets a receipt when the event was definitely not processed, so a genuine
-- provider retry of the same event is handled.
create or replace function public.release_webhook_receipt(p_source text, p_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from app.webhook_receipts where source = p_source and id = p_id
$$;

------------------------------------------------------------------------------
-- Identity provisioning (AUTH-001, AUTH-011, AUTH-012)
------------------------------------------------------------------------------

create or replace function app.e164(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    when left(p_phone, 1) = '+' then p_phone
    else '+' || p_phone
  end
$$;

create or replace function app.provision_profile(p_user_id uuid, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer;
begin
  insert into public.profiles (id, phone) values (p_user_id, app.e164(p_phone))
  on conflict (id) do nothing;
  get diagnostics v_created = row_count;
  if v_created = 1 then
    -- Phone identity alone grants only the buyer capability (GAP-04).
    insert into public.user_roles (user_id, role_id) values (p_user_id, 1)
    on conflict do nothing;
    insert into public.notification_intents (event_type, dedupe_key, recipient_id, entity_type, entity_id)
    values ('welcome', 'welcome:' || p_user_id, p_user_id, 'user', p_user_id)
    on conflict (dedupe_key) do nothing;
  end if;
  return v_created = 1;
end;
$$;

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
  return null;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_auth_user_change();
create trigger on_auth_user_phone_changed after update of phone on auth.users
  for each row execute function app.handle_auth_user_change();

-- Recovery path if the trigger did not run (AUTH-012). Idempotent.
create or replace function public.ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_phone text;
  v_created boolean;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  select u.phone into v_phone from auth.users u where u.id = v_actor;
  if not found then
    perform app.fail('AUTH_REQUIRED');
  end if;
  v_created := app.provision_profile(v_actor, v_phone);
  return jsonb_build_object('created', v_created);
end;
$$;

-- Self-service seller onboarding (GAP-04 PROPOSED): a phone-verified, active
-- user with a name may add the `seller` capability. `agent`, `admin` and
-- `super_admin` are never self-granted.
create or replace function public.become_seller(p_seller_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_added integer;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  if p_seller_type is null or p_seller_type not in ('owner', 'developer') then
    perform app.fail('VALIDATION_FAILED', 'seller_type');
  end if;
  select * into v_profile from public.profiles where id = v_actor for update;
  if not found then
    perform app.fail('PROFILE_MISSING');
  end if;
  if v_profile.is_suspended or v_profile.deleted_at is not null then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;
  if not exists (select 1 from auth.users u where u.id = v_actor and u.phone_confirmed_at is not null) then
    perform app.fail('PHONE_NOT_VERIFIED');
  end if;
  if v_profile.full_name is null then
    perform app.fail('PROFILE_INCOMPLETE', 'full_name');
  end if;

  insert into public.user_roles (user_id, role_id, granted_by) values (v_actor, 2, v_actor)
  on conflict do nothing;
  get diagnostics v_added = row_count;
  update public.profiles set user_type = p_seller_type where id = v_actor and user_type = 'buyer';

  if v_added = 1 then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_actor, 'role.self_onboard', 'user', v_actor::text, jsonb_build_object('role', 'seller', 'seller_type', p_seller_type));
  end if;
  return jsonb_build_object('added', v_added = 1);
end;
$$;

------------------------------------------------------------------------------
-- Listing lifecycle (architecture §30, test.md §2.1, GAP-01/09/13)
------------------------------------------------------------------------------

-- Every allowed transition. Anything not listed is denied (GAP-13).
create table app.property_transitions (
  from_status text not null,
  action text not null,
  to_status text not null,
  actor text not null check (actor in ('owner', 'admin')),
  requires_reason boolean not null default false,
  primary key (from_status, action, actor)
);

insert into app.property_transitions (from_status, action, to_status, actor, requires_reason) values
  ('draft',            'submit',          'submitted',        'owner', false),
  ('changes_required', 'submit',          'submitted',        'owner', false),
  ('submitted',        'begin_review',    'under_review',     'admin', false),
  ('under_review',     'request_changes', 'changes_required', 'admin', true),
  ('under_review',     'reject',          'rejected',         'admin', true),
  ('under_review',     'approve',         'verified',         'admin', false),
  ('verified',         'mark_sold',       'sold',             'owner', false),
  ('verified',         'mark_sold',       'sold',             'admin', true),
  ('sold',             'archive',         'archived',         'owner', false),
  ('sold',             'archive',         'archived',         'admin', true);

-- PROPOSED submission requirements (GAP-03). Returns the missing items.
create or replace function app.property_submission_gaps(p public.properties)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when p.title is null or char_length(btrim(p.title)) < 10 then 'title' end,
    case when p.description is null or char_length(btrim(p.description)) < 50 then 'description' end,
    case when p.property_type is null then 'property_type' end,
    case when p.seller_type is null then 'seller_type' end,
    case when p.price is null then 'price' end,
    case when p.area_value is null or p.area_unit is null then 'area' end,
    case when p.location_id is null or not p.location_active then 'location' end,
    case when not exists (
      select 1 from public.property_media m where m.property_id = p.id and m.removed_at is null) then 'photos' end,
    case when not exists (
      select 1 from public.property_media m where m.property_id = p.id and m.is_cover and m.removed_at is null) then 'cover_photo' end,
    case when not exists (
      select 1 from public.property_documents d where d.property_id = p.id and d.removed_at is null) then 'documents' end,
    case when exists (
      select 1 from app.upload_sessions s
      where s.property_id = p.id and s.state in ('initiated', 'processing') and s.expires_at > now()) then 'uploads_in_progress' end
  ], null)
$$;

create or replace function app.property_snapshot(p public.properties)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'property', to_jsonb(p) - array['owner_suspended', 'location_active', 'current_revision_id', 'is_listed'],
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'storage_path', m.storage_path, 'thumbnail_path', m.thumbnail_path,
        'content_checksum', m.content_checksum, 'sort_order', m.sort_order,
        'is_cover', m.is_cover, 'alt_text', m.alt_text) order by m.sort_order, m.id)
      from public.property_media m where m.property_id = p.id and m.removed_at is null), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'document_type', d.document_type, 'storage_path', d.storage_path,
        'content_checksum', d.content_checksum, 'mime_type', d.mime_type) order by d.created_at, d.id)
      from public.property_documents d where d.property_id = p.id and d.removed_at is null), '[]'::jsonb),
    'features', coalesce((
      select jsonb_object_agg(f.feature_key, f.feature_value)
      from public.property_features f where f.property_id = p.id), '{}'::jsonb))
$$;

create or replace function public.transition_property(
  p_property_id uuid,
  p_action text,
  p_expected_version integer,
  p_revision_id uuid default null,
  p_reason text default null,
  p_internal_notes text default null,
  p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_prop public.properties%rowtype;
  v_rule app.property_transitions%rowtype;
  v_is_owner boolean;
  v_is_admin boolean;
  v_reason text := nullif(btrim(p_reason), '');
  v_notes text := nullif(btrim(p_internal_notes), '');
  v_revision_id uuid;
  v_gaps text[];
  v_history_id bigint;
  v_event text;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  if not app.actor_is_active(v_actor) then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;

  select * into v_prop from public.properties p where p.id = p_property_id for update;
  if not found or v_prop.deleted_at is not null then
    perform app.fail('PROPERTY_NOT_FOUND');
  end if;

  -- Replay of an already committed request (e.g. a retried double-click) is
  -- reported as the current state rather than a new transition or a conflict.
  if p_request_id is not null and exists (
    select 1 from public.property_status_history h
    where h.property_id = p_property_id and h.request_id = p_request_id and h.actor_id = v_actor
  ) then
    return jsonb_build_object('property_id', v_prop.id, 'status', v_prop.status, 'version', v_prop.version,
                              'revision_id', v_prop.current_revision_id, 'replayed', true);
  end if;

  v_is_owner := v_prop.owner_id = v_actor and app.actor_has_any_role(v_actor, array['seller', 'agent']);
  v_is_admin := app.actor_has_any_role(v_actor, array['admin', 'super_admin']);

  if not v_is_owner and not v_is_admin then
    -- Do not reveal that a hidden listing exists (DOC-009 style).
    if app.listing_visible(v_prop.is_listed, v_prop.published_at, v_prop.expires_at) then
      perform app.fail('FORBIDDEN');
    end if;
    perform app.fail('PROPERTY_NOT_FOUND');
  end if;

  -- Owner rules first. Admin rules never apply to the admin's own listing.
  select * into v_rule from app.property_transitions t
   where t.from_status = v_prop.status
     and t.action = p_action
     and ((t.actor = 'owner' and v_is_owner)
          or (t.actor = 'admin' and v_is_admin and v_prop.owner_id <> v_actor))
   order by (t.actor = 'owner') desc
   limit 1;
  if not found then
    if v_is_admin and v_prop.owner_id = v_actor and exists (
      select 1 from app.property_transitions t
      where t.from_status = v_prop.status and t.action = p_action and t.actor = 'admin'
    ) then
      perform app.fail('SELF_REVIEW_FORBIDDEN');
    end if;
    perform app.fail('INVALID_STATUS_TRANSITION', v_prop.status || ':' || coalesce(p_action, ''));
  end if;

  if p_expected_version is distinct from v_prop.version then
    perform app.fail('VERSION_CONFLICT', v_prop.version::text);
  end if;

  if v_rule.requires_reason and (v_reason is null or char_length(v_reason) < 5) then
    perform app.fail('REASON_REQUIRED');
  end if;
  if char_length(v_reason) > 2000 or char_length(v_notes) > 4000 then
    perform app.fail('VALIDATION_FAILED', 'reason');
  end if;

  v_revision_id := v_prop.current_revision_id;

  if p_action = 'submit' then
    v_gaps := app.property_submission_gaps(v_prop);
    if cardinality(v_gaps) > 0 then
      perform app.fail('LISTING_INCOMPLETE', array_to_string(v_gaps, ','));
    end if;
    if not exists (select 1 from auth.users u where u.id = v_actor and u.phone_confirmed_at is not null) then
      perform app.fail('PHONE_NOT_VERIFIED');
    end if;
    insert into public.property_revisions (property_id, revision_no, snapshot, submitted_by)
    values (
      v_prop.id,
      coalesce((select max(r.revision_no) from public.property_revisions r where r.property_id = v_prop.id), 0) + 1,
      app.property_snapshot(v_prop),
      v_actor)
    returning id into v_revision_id;
  elsif p_action in ('begin_review', 'approve', 'reject', 'request_changes') then
    -- Reviewers act on the exact submitted revision they were shown (GAP-09).
    if p_revision_id is null or p_revision_id is distinct from v_prop.current_revision_id then
      perform app.fail('REVISION_MISMATCH');
    end if;
  end if;

  update public.properties p set
    status = v_rule.to_status,
    current_revision_id = v_revision_id,
    published_at = case when p_action = 'approve' then now() else p.published_at end,
    first_published_at = case when p_action = 'approve' then coalesce(p.first_published_at, now()) else p.first_published_at end
  where p.id = v_prop.id
  returning * into v_prop;

  insert into public.property_status_history
    (property_id, from_status, to_status, action, actor_id, revision_id, reason, request_id)
  values
    (v_prop.id, v_rule.from_status, v_rule.to_status, p_action, v_actor, v_revision_id, v_reason, p_request_id)
  returning id into v_history_id;

  if p_action in ('approve', 'reject', 'request_changes') then
    insert into public.verification_reviews (property_id, revision_id, reviewer_id, decision, owner_message, internal_notes)
    values (
      v_prop.id, v_revision_id, v_actor,
      case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes_requested' end,
      v_reason, v_notes);
  end if;

  if v_rule.actor = 'admin' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_actor, 'property.' || p_action, 'property', v_prop.id::text,
            jsonb_build_object('from', v_rule.from_status, 'to', v_rule.to_status,
                               'revision_id', v_revision_id, 'reason', v_reason));
  end if;

  v_event := case p_action
    when 'submit' then 'listing_submitted'
    when 'approve' then 'listing_approved'
    when 'reject' then 'listing_rejected'
    when 'request_changes' then 'changes_requested'
  end;
  if v_event is not null then
    insert into public.notification_intents (event_type, dedupe_key, recipient_id, entity_type, entity_id, payload)
    values (v_event, v_event || ':' || v_history_id, v_prop.owner_id, 'property', v_prop.id,
            jsonb_build_object('revision_id', v_revision_id))
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object('property_id', v_prop.id, 'status', v_prop.status, 'version', v_prop.version,
                            'revision_id', v_revision_id, 'replayed', false);
end;
$$;

-- Owner soft-deletes an unsubmitted draft (GAP-13 PROPOSED: drafts only).
create or replace function public.delete_property_draft(p_property_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_prop public.properties%rowtype;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  select * into v_prop from public.properties p where p.id = p_property_id for update;
  if not found or v_prop.deleted_at is not null or v_prop.owner_id <> v_actor then
    perform app.fail('PROPERTY_NOT_FOUND');
  end if;
  if not app.actor_is_active(v_actor) then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;
  if v_prop.status <> 'draft' then
    perform app.fail('INVALID_STATUS_TRANSITION', v_prop.status || ':delete');
  end if;
  if p_expected_version is distinct from v_prop.version then
    perform app.fail('VERSION_CONFLICT', v_prop.version::text);
  end if;
  update public.properties set deleted_at = now() where id = v_prop.id;
  return jsonb_build_object('property_id', v_prop.id, 'deleted', true);
end;
$$;

------------------------------------------------------------------------------
-- Listing media / documents (owner operations on finalized rows)
------------------------------------------------------------------------------

-- Locks the listing and asserts the actor may change its content now.
create or replace function app.lock_editable_listing(p_actor uuid, p_property_id uuid)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop public.properties%rowtype;
begin
  select * into v_prop from public.properties p where p.id = p_property_id for no key update;
  if not found or v_prop.deleted_at is not null or v_prop.owner_id <> p_actor then
    perform app.fail('PROPERTY_NOT_FOUND');
  end if;
  if not app.actor_is_active(p_actor) then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;
  if not app.actor_has_any_role(p_actor, array['seller', 'agent']) then
    perform app.fail('FORBIDDEN');
  end if;
  if v_prop.status not in ('draft', 'changes_required') then
    perform app.fail('PROPERTY_NOT_EDITABLE', v_prop.status);
  end if;
  return v_prop;
end;
$$;

create or replace function public.arrange_property_media(
  p_property_id uuid, p_ordered_ids uuid[], p_cover_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  perform app.lock_editable_listing(v_actor, p_property_id);

  -- The submitted order must be exactly the listing's current photos.
  if p_ordered_ids is null
     or cardinality(p_ordered_ids) <> (select count(distinct x) from unnest(p_ordered_ids) x)
     or (select array_agg(m.id order by m.id) from public.property_media m
          where m.property_id = p_property_id and m.removed_at is null)
        is distinct from (select array_agg(x order by x) from unnest(p_ordered_ids) x)
     or not (p_cover_id = any (p_ordered_ids)) then
    perform app.fail('VALIDATION_FAILED', 'media_order');
  end if;

  update public.property_media set is_cover = false
   where property_id = p_property_id and is_cover and id <> p_cover_id;
  update public.property_media m
     set sort_order = o.ord - 1,
         is_cover = (m.id = p_cover_id)
    from unnest(p_ordered_ids) with ordinality as o (id, ord)
   where m.id = o.id and m.property_id = p_property_id;

  return jsonb_build_object('property_id', p_property_id, 'count', cardinality(p_ordered_ids));
end;
$$;

create or replace function public.remove_property_media(p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_media public.property_media%rowtype;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  select * into v_media from public.property_media m where m.id = p_media_id and m.removed_at is null;
  if not found then
    perform app.fail('MEDIA_NOT_FOUND');
  end if;
  perform app.lock_editable_listing(v_actor, v_media.property_id);

  -- Objects are retained; byte deletion follows the retention policy (GAP-19).
  update public.property_media set removed_at = now(), is_cover = false where id = v_media.id;
  if v_media.is_cover then
    update public.property_media set is_cover = true
     where id = (select m.id from public.property_media m
                  where m.property_id = v_media.property_id and m.removed_at is null
                  order by m.sort_order, m.created_at limit 1);
  end if;
  return jsonb_build_object('media_id', v_media.id, 'removed', true);
end;
$$;

create or replace function public.remove_property_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_property_id uuid;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  select d.property_id into v_property_id from public.property_documents d
   where d.id = p_document_id and d.removed_at is null;
  if not found then
    perform app.fail('DOCUMENT_NOT_FOUND');
  end if;
  perform app.lock_editable_listing(v_actor, v_property_id);
  update public.property_documents set removed_at = now() where id = p_document_id;
  return jsonb_build_object('document_id', p_document_id, 'removed', true);
end;
$$;

------------------------------------------------------------------------------
-- Upload sessions (architecture §13, STOR-002/004/005, MEDIA-002/009).
-- service_role only; Next.js authenticates the user and passes p_actor_id.
------------------------------------------------------------------------------

create or replace function public.upload_session_create(
  p_actor_id uuid,
  p_property_id uuid,
  p_kind text,
  p_document_type text,
  p_declared_size integer,
  p_declared_mime text,
  p_original_filename text,
  p_bucket text,
  p_max_items integer,
  p_ttl_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing integer;
  v_limit record;
  v_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + make_interval(secs => p_ttl_seconds);
begin
  if p_kind not in ('property_image', 'property_document') then
    perform app.fail('VALIDATION_FAILED', 'kind');
  end if;
  perform app.lock_editable_listing(p_actor_id, p_property_id);

  select * into v_limit from app.rate_limit_consume('upload_initiate', p_actor_id::text);
  if not v_limit.allowed then
    perform app.fail('RATE_LIMITED', v_limit.retry_after_seconds::text);
  end if;

  -- In-flight sessions count toward the limit so parallel uploads cannot
  -- exceed it (MEDIA-002). The listing row lock serializes this check.
  v_existing :=
    case p_kind
      when 'property_image' then
        (select count(*) from public.property_media m where m.property_id = p_property_id and m.removed_at is null)
      else
        (select count(*) from public.property_documents d where d.property_id = p_property_id and d.removed_at is null)
    end
    + (select count(*) from app.upload_sessions s
        where s.property_id = p_property_id and s.kind = p_kind
          and s.state in ('initiated', 'processing') and s.expires_at > now());
  if v_existing >= p_max_items then
    perform app.fail('UPLOAD_LIMIT_REACHED', p_max_items::text);
  end if;

  insert into app.upload_sessions (id, actor_id, property_id, kind, document_type, bucket, quarantine_key,
                                   declared_size, declared_mime, original_filename, expires_at)
  values (v_id, p_actor_id, p_property_id, p_kind, p_document_type, p_bucket, 'quarantine/' || v_id,
          p_declared_size, p_declared_mime, p_original_filename, v_expires);

  return jsonb_build_object('session_id', v_id, 'quarantine_key', 'quarantine/' || v_id, 'expires_at', v_expires);
end;
$$;

-- Takes a processing lease so only one worker validates a session's bytes.
create or replace function public.upload_session_claim(
  p_session_id uuid, p_actor_id uuid, p_lease_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s app.upload_sessions%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select * into v_s from app.upload_sessions where id = p_session_id for update;
  if not found or v_s.actor_id <> p_actor_id then
    perform app.fail('UPLOAD_NOT_FOUND');
  end if;
  if v_s.state = 'finalized' then
    return jsonb_build_object('state', 'finalized', 'result_id', v_s.result_id, 'kind', v_s.kind);
  end if;
  if v_s.state = 'failed' then
    perform app.fail('UPLOAD_FAILED', coalesce(v_s.error_code, ''));
  end if;
  if v_s.expires_at <= now() then
    perform app.fail('UPLOAD_EXPIRED');
  end if;
  if v_s.state = 'processing' and v_s.lease_until > now() then
    perform app.fail('UPLOAD_IN_PROGRESS');
  end if;
  perform app.lock_editable_listing(p_actor_id, v_s.property_id);

  update app.upload_sessions
     set state = 'processing',
         lease_until = now() + make_interval(secs => p_lease_seconds),
         lease_token = v_token
   where id = v_s.id;

  return jsonb_build_object(
    'state', 'processing', 'lease_token', v_token, 'property_id', v_s.property_id,
    'kind', v_s.kind, 'document_type', v_s.document_type, 'bucket', v_s.bucket,
    'quarantine_key', v_s.quarantine_key, 'declared_size', v_s.declared_size,
    'declared_mime', v_s.declared_mime, 'original_filename', v_s.original_filename);
end;
$$;

-- Returns the session locked for the current lease holder. A worker whose
-- lease was taken over (lease expired, re-claimed) cannot finalize.
create or replace function app.lock_session_for_lease(p_session_id uuid, p_actor_id uuid, p_lease_token uuid)
returns app.upload_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s app.upload_sessions%rowtype;
begin
  select * into v_s from app.upload_sessions where id = p_session_id for update;
  if not found or v_s.actor_id <> p_actor_id then
    perform app.fail('UPLOAD_NOT_FOUND');
  end if;
  if v_s.state = 'finalized' then
    return v_s;
  end if;
  if v_s.state <> 'processing' or v_s.lease_token is distinct from p_lease_token then
    perform app.fail('UPLOAD_LEASE_LOST');
  end if;
  return v_s;
end;
$$;

create or replace function public.upload_session_finalize_media(
  p_session_id uuid,
  p_actor_id uuid,
  p_lease_token uuid,
  p_media_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_thumbnail_path text,
  p_checksum text,
  p_width integer,
  p_height integer,
  p_byte_size integer,
  p_max_items integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s app.upload_sessions%rowtype;
  v_count integer;
begin
  v_s := app.lock_session_for_lease(p_session_id, p_actor_id, p_lease_token);
  if v_s.state = 'finalized' then
    return jsonb_build_object('id', v_s.result_id, 'replayed', true);
  end if;
  if v_s.kind <> 'property_image' then
    perform app.fail('VALIDATION_FAILED', 'kind');
  end if;
  -- Recheck owner, account and listing state at commit time (MEDIA-009).
  perform app.lock_editable_listing(p_actor_id, v_s.property_id);

  select count(*) into v_count from public.property_media m
   where m.property_id = v_s.property_id and m.removed_at is null;
  if v_count >= p_max_items then
    perform app.fail('UPLOAD_LIMIT_REACHED', p_max_items::text);
  end if;

  insert into public.property_media (id, property_id, storage_bucket, storage_path, thumbnail_path,
                                     content_checksum, width, height, byte_size, sort_order, is_cover, uploaded_by)
  values (
    p_media_id, v_s.property_id, p_storage_bucket, p_storage_path, p_thumbnail_path,
    p_checksum, p_width, p_height, p_byte_size,
    coalesce((select max(m.sort_order) + 1 from public.property_media m
               where m.property_id = v_s.property_id and m.removed_at is null), 0),
    not exists (select 1 from public.property_media m
                 where m.property_id = v_s.property_id and m.is_cover and m.removed_at is null),
    p_actor_id);

  update app.upload_sessions
     set state = 'finalized', result_id = p_media_id, finalized_at = now(), lease_until = null, lease_token = null
   where id = v_s.id;
  return jsonb_build_object('id', p_media_id, 'replayed', false);
end;
$$;

create or replace function public.upload_session_finalize_document(
  p_session_id uuid,
  p_actor_id uuid,
  p_lease_token uuid,
  p_document_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_checksum text,
  p_mime_type text,
  p_byte_size integer,
  p_max_items integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s app.upload_sessions%rowtype;
  v_count integer;
begin
  v_s := app.lock_session_for_lease(p_session_id, p_actor_id, p_lease_token);
  if v_s.state = 'finalized' then
    return jsonb_build_object('id', v_s.result_id, 'replayed', true);
  end if;
  if v_s.kind <> 'property_document' then
    perform app.fail('VALIDATION_FAILED', 'kind');
  end if;
  perform app.lock_editable_listing(p_actor_id, v_s.property_id);

  select count(*) into v_count from public.property_documents d
   where d.property_id = v_s.property_id and d.removed_at is null;
  if v_count >= p_max_items then
    perform app.fail('UPLOAD_LIMIT_REACHED', p_max_items::text);
  end if;

  insert into public.property_documents (id, property_id, document_type, storage_bucket, storage_path,
                                         content_checksum, mime_type, byte_size, original_filename, uploaded_by)
  values (p_document_id, v_s.property_id, v_s.document_type, p_storage_bucket, p_storage_path,
          p_checksum, p_mime_type, p_byte_size, v_s.original_filename, p_actor_id);

  update app.upload_sessions
     set state = 'finalized', result_id = p_document_id, finalized_at = now(), lease_until = null, lease_token = null
   where id = v_s.id;
  return jsonb_build_object('id', p_document_id, 'replayed', false);
end;
$$;

-- Returns a claimed session to `initiated` without failing it, e.g. when the
-- browser has not finished uploading yet. Only the lease holder can release.
create or replace function public.upload_session_release(
  p_session_id uuid, p_actor_id uuid, p_lease_token uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.upload_sessions
     set state = 'initiated', lease_until = null, lease_token = null
   where id = p_session_id
     and actor_id = p_actor_id
     and state = 'processing'
     and lease_token = p_lease_token
$$;

create or replace function public.upload_session_fail(
  p_session_id uuid, p_actor_id uuid, p_lease_token uuid, p_error_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.upload_sessions
     set state = 'failed', error_code = left(p_error_code, 60), lease_until = null, lease_token = null
   where id = p_session_id
     and actor_id = p_actor_id
     and state = 'processing'
     and lease_token = p_lease_token;
end;
$$;

------------------------------------------------------------------------------
-- Buyer operations
------------------------------------------------------------------------------

-- GAP-08 PROPOSED: derive both parties server-side, deny self-contact, one
-- enquiry per idempotency key, rate limited per buyer.
create or replace function public.create_enquiry(
  p_property_id uuid, p_message text, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_prop public.properties%rowtype;
  v_message text := nullif(btrim(p_message), '');
  v_id uuid;
  v_limit record;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  if not app.actor_is_active(v_actor) then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;
  if p_idempotency_key is null then
    perform app.fail('VALIDATION_FAILED', 'idempotency_key');
  end if;
  if char_length(v_message) > 1000 then
    perform app.fail('VALIDATION_FAILED', 'message');
  end if;

  select e.id into v_id from public.enquiries e
   where e.buyer_id = v_actor and e.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('enquiry_id', v_id, 'replayed', true);
  end if;

  -- Availability is checked at commit with the listing row share-locked.
  select * into v_prop from public.properties p where p.id = p_property_id for share;
  if not found or not app.listing_visible(v_prop.is_listed, v_prop.published_at, v_prop.expires_at) then
    perform app.fail('PROPERTY_NOT_AVAILABLE');
  end if;
  if v_prop.owner_id = v_actor then
    perform app.fail('SELF_ENQUIRY_FORBIDDEN');
  end if;

  select * into v_limit from app.rate_limit_consume('enquiry_create', v_actor::text);
  if not v_limit.allowed then
    perform app.fail('RATE_LIMITED', v_limit.retry_after_seconds::text);
  end if;

  insert into public.enquiries (property_id, buyer_id, seller_id, message, idempotency_key)
  values (v_prop.id, v_actor, v_prop.owner_id, v_message, p_idempotency_key)
  on conflict (buyer_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select e.id into v_id from public.enquiries e
     where e.buyer_id = v_actor and e.idempotency_key = p_idempotency_key;
    return jsonb_build_object('enquiry_id', v_id, 'replayed', true);
  end if;

  insert into public.notification_intents (event_type, dedupe_key, recipient_id, entity_type, entity_id, payload)
  values ('new_enquiry', 'new_enquiry:' || v_id, v_prop.owner_id, 'enquiry', v_id,
          jsonb_build_object('property_id', v_prop.id))
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('enquiry_id', v_id, 'replayed', false);
end;
$$;

create or replace function public.record_property_view(p_property_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not app.actor_is_active(v_actor) then
    return false;
  end if;
  if not exists (
    select 1 from public.properties p
    where p.id = p_property_id and app.listing_visible(p.is_listed, p.published_at, p.expires_at)
  ) then
    return false;
  end if;
  insert into public.recently_viewed (user_id, property_id, viewed_at)
  values (v_actor, p_property_id, now())
  on conflict (user_id, property_id) do update set viewed_at = excluded.viewed_at;
  return true;
end;
$$;

-- Approved public seller projection (ROLE-008). Never phone or email.
create or replace function public.get_listing_seller(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', coalesce(pr.full_name, 'Property owner'),
    'seller_type', p.seller_type,
    'member_since', to_char(pr.created_at, 'YYYY-MM'))
  from public.properties p
  join public.profiles pr on pr.id = p.owner_id
  where p.id = p_property_id
    and app.listing_visible(p.is_listed, p.published_at, p.expires_at)
$$;

------------------------------------------------------------------------------
-- Administration (GAP-05 PROPOSED boundaries)
--   admin:       ordinary users (buyer/seller/agent roles, suspension), content
--   super_admin: additionally admin/super_admin roles and privileged accounts
--   nobody:      self-promotion/demotion, self-suspension, removing the last
--                active super admin
------------------------------------------------------------------------------

create or replace function app.user_holds_role(p_user uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.name = any (p_roles))
$$;

-- Serializes super-admin changes and fails if p_excluded_user is the last
-- active super admin.
create or replace function app.assert_other_super_admin_remains(p_excluded_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.user_roles ur where ur.role_id = 5 for update;
  if not exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role_id = 5 and ur.user_id <> p_excluded_user
      and not p.is_suspended and p.deleted_at is null
  ) then
    perform app.fail('LAST_SUPER_ADMIN');
  end if;
end;
$$;

create or replace function app.require_admin_actor()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  if not app.actor_has_any_role(v_actor, array['admin', 'super_admin']) then
    perform app.fail('FORBIDDEN');
  end if;
  return v_actor;
end;
$$;

create or replace function public.admin_change_role(
  p_user_id uuid, p_role text, p_grant boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.require_admin_actor();
  v_actor_super boolean := app.actor_has_any_role(v_actor, array['super_admin']);
  v_role_id smallint;
  v_reason text := nullif(btrim(p_reason), '');
  v_changed integer;
begin
  select r.id into v_role_id from public.roles r where r.name = p_role;
  if v_role_id is null or p_grant is null then
    perform app.fail('VALIDATION_FAILED', 'role');
  end if;
  if v_reason is null or char_length(v_reason) not between 5 and 500 then
    perform app.fail('REASON_REQUIRED');
  end if;
  if p_role in ('admin', 'super_admin') and not v_actor_super then
    perform app.fail('FORBIDDEN');
  end if;
  if p_user_id = v_actor and p_role in ('admin', 'super_admin') then
    perform app.fail('SELF_ROLE_CHANGE_FORBIDDEN');
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    perform app.fail('USER_NOT_FOUND');
  end if;
  if not v_actor_super and app.user_holds_role(p_user_id, array['admin', 'super_admin']) then
    perform app.fail('FORBIDDEN');
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role_id, granted_by) values (p_user_id, v_role_id, v_actor)
    on conflict do nothing;
  else
    if p_role = 'super_admin' then
      perform app.assert_other_super_admin_remains(p_user_id);
    end if;
    delete from public.user_roles where user_id = p_user_id and role_id = v_role_id;
  end if;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_actor, case when p_grant then 'role.grant' else 'role.revoke' end, 'user', p_user_id::text,
            jsonb_build_object('role', p_role, 'reason', v_reason));
  end if;
  return jsonb_build_object('changed', v_changed > 0);
end;
$$;

create or replace function public.admin_set_suspension(
  p_user_id uuid, p_suspended boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.require_admin_actor();
  v_reason text := nullif(btrim(p_reason), '');
  v_profile public.profiles%rowtype;
begin
  if p_suspended is null then
    perform app.fail('VALIDATION_FAILED', 'suspended');
  end if;
  if v_reason is null or char_length(v_reason) not between 5 and 500 then
    perform app.fail('REASON_REQUIRED');
  end if;
  if p_user_id = v_actor then
    perform app.fail('SELF_ACTION_FORBIDDEN');
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    perform app.fail('USER_NOT_FOUND');
  end if;
  if app.user_holds_role(p_user_id, array['admin', 'super_admin'])
     and not app.actor_has_any_role(v_actor, array['super_admin']) then
    perform app.fail('FORBIDDEN');
  end if;
  if p_suspended and app.user_holds_role(p_user_id, array['super_admin']) then
    perform app.assert_other_super_admin_remains(p_user_id);
  end if;
  if v_profile.is_suspended = p_suspended then
    return jsonb_build_object('changed', false);
  end if;

  update public.profiles
     set is_suspended = p_suspended,
         suspended_at = case when p_suspended then now() end,
         suspension_reason = case when p_suspended then v_reason end
   where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, case when p_suspended then 'user.suspend' else 'user.reactivate' end, 'user', p_user_id::text,
          jsonb_build_object('reason', v_reason));
  return jsonb_build_object('changed', true);
end;
$$;

create or replace function public.admin_set_featured(
  p_property_id uuid, p_featured boolean, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.require_admin_actor();
  v_prop public.properties%rowtype;
begin
  select * into v_prop from public.properties p where p.id = p_property_id for update;
  if not found or v_prop.deleted_at is not null then
    perform app.fail('PROPERTY_NOT_FOUND');
  end if;
  if p_expected_version is distinct from v_prop.version then
    perform app.fail('VERSION_CONFLICT', v_prop.version::text);
  end if;
  if p_featured and v_prop.status <> 'verified' then
    perform app.fail('INVALID_STATUS_TRANSITION', v_prop.status || ':feature');
  end if;
  if v_prop.featured = p_featured then
    return jsonb_build_object('property_id', v_prop.id, 'version', v_prop.version, 'changed', false);
  end if;
  update public.properties set featured = p_featured where id = v_prop.id returning * into v_prop;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, case when p_featured then 'property.feature' else 'property.unfeature' end,
          'property', v_prop.id::text, '{}'::jsonb);
  return jsonb_build_object('property_id', v_prop.id, 'version', v_prop.version, 'changed', true);
end;
$$;

create or replace function public.admin_add_note(p_entity_type text, p_entity_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.require_admin_actor();
  v_id uuid;
begin
  insert into public.admin_notes (entity_type, entity_id, admin_id, note)
  values (p_entity_type, p_entity_id, v_actor, btrim(p_note))
  returning id into v_id;
  return v_id;
end;
$$;
