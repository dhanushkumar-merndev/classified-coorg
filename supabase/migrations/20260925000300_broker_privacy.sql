-- Broker model: Land in Coorg earns commission by sitting between buyer and
-- owner. Buyers deal only with the platform and owners only with the platform,
-- so neither side can reach the other through the product or its public API.
--   * the public never sees who owns a listing, what kind of seller it is, or
--     its exact address / coordinates (town-level location only);
--   * buyer enquiries go to the platform team, never to the owner;
--   * owners see how many buyers are interested, never who they are;
--   * listings that put a phone number or email in the text cannot be submitted.

------------------------------------------------------------------------------
-- 1. Public listing reads: column allowlist for anon.
------------------------------------------------------------------------------
-- Signed-in users keep table-level SELECT (owners and admins read their own
-- rows in full); the app never shows these columns publicly.
revoke select on public.properties from anon;
grant select (
  id, slug, title, description, property_type, listing_type, price, negotiable,
  area_value, area_unit, location_id, road_access, water_available, electricity_available,
  status, featured, published_at, first_published_at, expires_at, location_active,
  verification_status, area_sqft, price_per_unit, is_listed, created_at, updated_at
) on public.properties to anon;

-- The public seller projection (name, seller type, member since) is retired.
revoke execute on function public.get_listing_seller(uuid) from anon, authenticated;

------------------------------------------------------------------------------
-- 2. Enquiries belong to the buyer and the platform team.
------------------------------------------------------------------------------
drop policy if exists enquiries_select_participant on public.enquiries;
create policy enquiries_select_buyer_or_admin on public.enquiries for select to authenticated
  using (buyer_id = (select auth.uid()) or (select app.is_admin()));

-- The seller inbox exposed buyer names and phone numbers.
revoke execute on function public.list_received_enquiries(text, integer, integer) from authenticated;

-- Owners still see demand per listing, as counts only.
create or replace function public.seller_enquiry_counts()
returns table (property_id uuid, total bigint, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.property_id, count(*), count(*) filter (where e.status = 'new')
  from public.enquiries e
  where e.seller_id = (select auth.uid())
  group by e.property_id
$$;

-- Status is worked by the platform team (new -> read -> closed).
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
  if not app.actor_is_active(v_actor) or not app.is_admin() then
    perform app.fail('FORBIDDEN');
  end if;
  if p_status is null or p_status not in ('read', 'closed') then
    perform app.fail('VALIDATION_FAILED', 'status');
  end if;
  select * into v_enquiry from public.enquiries where id = p_enquiry_id for update;
  if not found then
    perform app.fail('ENQUIRY_NOT_FOUND');
  end if;
  if v_enquiry.status = p_status or v_enquiry.status = 'closed' then
    return jsonb_build_object('enquiry_id', v_enquiry.id, 'status', v_enquiry.status, 'changed', false);
  end if;
  update public.enquiries set status = p_status where id = v_enquiry.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'enquiry.' || p_status, 'enquiry', v_enquiry.id::text,
          jsonb_build_object('from', v_enquiry.status, 'to', p_status));
  return jsonb_build_object('enquiry_id', v_enquiry.id, 'status', p_status, 'changed', true);
end;
$$;

-- New enquiries notify the platform team, not the owner. Admins are a handful
-- of rows found through the user_roles primary key, never a scan of users.
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
  select 'new_enquiry', 'new_enquiry:' || v_id || ':' || ur.user_id, ur.user_id, 'enquiry', v_id,
         jsonb_build_object('property_id', v_prop.id)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles pr on pr.id = ur.user_id
  where r.name in ('admin', 'super_admin') and not pr.is_suspended and pr.deleted_at is null
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('enquiry_id', v_id, 'replayed', false);
end;
$$;

------------------------------------------------------------------------------
-- 3. No contact details inside listing text.
------------------------------------------------------------------------------
-- Indian mobile numbers (with or without +91 / 0, spaced or dashed) and email
-- addresses. Checked at submission, so drafts can still autosave.
create or replace function app.text_has_contact_details(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    or regexp_replace(p_text, '[\s().-]', '', 'g') ~ '(\+?91|0)?[6-9][0-9]{9}',
    false)
$$;

revoke all on function app.text_has_contact_details(text) from public, anon, authenticated;

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
    case when app.text_has_contact_details(coalesce(p.title, '') || ' ' || coalesce(p.description, '')) then 'contact_details' end,
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
