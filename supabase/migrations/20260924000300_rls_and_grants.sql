-- Row level security and privileges (architecture §9, test.md §4.2, GAP-22).
--
-- Deny by default: enable RLS on every public table, revoke every client
-- privilege, then grant back an explicit allowlist. Session-scoped helper calls
-- are wrapped in `(select ...)` so they are evaluated once per statement.
-- Admin/privileged reads that need private columns (internal notes, audit
-- logs) go through the server with the service role after application-level
-- authorization; they are intentionally not reachable with a user JWT.

do $$
declare
  r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema app from public, anon, authenticated, service_role;
revoke all on all sequences in schema app from public, anon, authenticated, service_role;
revoke all on all functions in schema app from public, anon, authenticated, service_role;

-- New objects are not exposed to clients until a migration grants them.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Append-only records stay append-only even for the server's service role.
revoke update, delete, truncate on public.audit_logs, public.property_revisions, public.property_status_history from service_role;

-- Helpers referenced from policies must be executable by the policy's role.
grant usage on schema app to anon, authenticated;
grant execute on function
  app.is_admin(),
  app.is_active_user(),
  app.has_any_role(text[]),
  app.listing_visible(boolean, timestamptz, timestamptz)
to anon, authenticated;

------------------------------------------------------------------------------
-- Identity
------------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select app.is_admin()));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select app.is_active_user()))
  with check (id = (select auth.uid()));

grant select on public.roles to anon, authenticated;

create policy roles_select on public.roles for select to anon, authenticated
  using (true);

grant select on public.user_roles to authenticated;

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app.is_admin()));

------------------------------------------------------------------------------
-- Locations
------------------------------------------------------------------------------

grant select on public.locations to anon, authenticated;

create policy locations_select on public.locations for select to anon, authenticated
  using (is_active or (select app.is_admin()));

------------------------------------------------------------------------------
-- Properties
------------------------------------------------------------------------------

grant select on public.properties to anon, authenticated;
grant insert (title, description, property_type, listing_type, seller_type, price, negotiable,
              area_value, area_unit, location_id, latitude, longitude, address_text,
              road_access, water_available, electricity_available)
  on public.properties to authenticated;
grant update (title, description, property_type, listing_type, seller_type, price, negotiable,
              area_value, area_unit, location_id, latitude, longitude, address_text,
              road_access, water_available, electricity_available)
  on public.properties to authenticated;

-- Separate permissive policies (Postgres ORs them per role). For anon the
-- only qual is the public predicate, which implies `is_listed`, so the
-- partial feed indexes apply. Public queries made with a user session must
-- add the same predicate explicitly (src/lib/listing/public-filter.ts) to get
-- the same plans.
create policy properties_select_public on public.properties for select to anon, authenticated
  using (app.listing_visible(is_listed, published_at, expires_at));

create policy properties_select_own on public.properties for select to authenticated
  using (owner_id = (select auth.uid()));

create policy properties_select_admin on public.properties for select to authenticated
  using ((select app.is_admin()));

create policy properties_insert_own on public.properties for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select app.has_any_role(array['seller', 'agent'])));

create policy properties_update_own_editable on public.properties for update to authenticated
  using (
    owner_id = (select auth.uid())
    and status in ('draft', 'changes_required')
    and deleted_at is null
    and (select app.is_active_user()))
  with check (
    owner_id = (select auth.uid())
    and status in ('draft', 'changes_required')
    and deleted_at is null);

-- Children inherit parent visibility: the EXISTS runs under the caller's
-- properties policy, so anon sees children of public listings only.
grant select on public.property_media to anon, authenticated;
grant update (alt_text) on public.property_media to authenticated;

create policy property_media_select on public.property_media for select to anon, authenticated
  using (
    (removed_at is null and exists (select 1 from public.properties p where p.id = property_media.property_id))
    or (select app.is_admin()));

create policy property_media_update_owner on public.property_media for update to authenticated
  using (
    removed_at is null
    and (select app.is_active_user())
    and exists (
      select 1 from public.properties p
      where p.id = property_media.property_id and p.owner_id = (select auth.uid())
        and p.status in ('draft', 'changes_required') and p.deleted_at is null))
  with check (
    removed_at is null
    and exists (
      select 1 from public.properties p
      where p.id = property_media.property_id and p.owner_id = (select auth.uid())
        and p.status in ('draft', 'changes_required') and p.deleted_at is null));

-- Private documents: owner and admins only; never anon (DOC-002).
grant select on public.property_documents to authenticated;

create policy property_documents_select on public.property_documents for select to authenticated
  using (
    exists (select 1 from public.properties p
            where p.id = property_documents.property_id and p.owner_id = (select auth.uid()))
    or (select app.is_admin()));

grant select on public.property_features to anon, authenticated;
grant insert (property_id, feature_key, feature_value) on public.property_features to authenticated;
grant update (feature_value) on public.property_features to authenticated;
grant delete on public.property_features to authenticated;

create policy property_features_select on public.property_features for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_features.property_id));

create policy property_features_insert_owner on public.property_features for insert to authenticated
  with check (
    (select app.is_active_user())
    and exists (
      select 1 from public.properties p
      where p.id = property_features.property_id and p.owner_id = (select auth.uid())
        and p.status in ('draft', 'changes_required') and p.deleted_at is null));

create policy property_features_update_owner on public.property_features for update to authenticated
  using (
    (select app.is_active_user())
    and exists (
      select 1 from public.properties p
      where p.id = property_features.property_id and p.owner_id = (select auth.uid())
        and p.status in ('draft', 'changes_required') and p.deleted_at is null))
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_features.property_id and p.owner_id = (select auth.uid())
        and p.status in ('draft', 'changes_required') and p.deleted_at is null));

create policy property_features_delete_owner on public.property_features for delete to authenticated
  using (
    (select app.is_active_user())
    and exists (
      select 1 from public.properties p
      where p.id = property_features.property_id and p.owner_id = (select auth.uid())
        and p.status in ('draft', 'changes_required') and p.deleted_at is null));

grant select on public.property_revisions to authenticated;

create policy property_revisions_select on public.property_revisions for select to authenticated
  using (
    exists (select 1 from public.properties p
            where p.id = property_revisions.property_id and p.owner_id = (select auth.uid()))
    or (select app.is_admin()));

grant select on public.property_status_history to authenticated;

create policy property_status_history_select on public.property_status_history for select to authenticated
  using (
    exists (select 1 from public.properties p
            where p.id = property_status_history.property_id and p.owner_id = (select auth.uid()))
    or (select app.is_admin()));

grant select on public.property_slug_history to anon, authenticated;

create policy property_slug_history_select on public.property_slug_history for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_slug_history.property_id));

-- Owner-facing review feedback only; internal_notes has no client grant (DOC-006).
grant select (id, property_id, revision_id, decision, owner_message, created_at)
  on public.verification_reviews to authenticated;

create policy verification_reviews_select on public.verification_reviews for select to authenticated
  using (
    exists (select 1 from public.properties p
            where p.id = verification_reviews.property_id and p.owner_id = (select auth.uid()))
    or (select app.is_admin()));

------------------------------------------------------------------------------
-- Buyer data
------------------------------------------------------------------------------

grant select, delete on public.favorites to authenticated;
grant insert (property_id) on public.favorites to authenticated;

create policy favorites_select_own on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));

create policy favorites_insert_own on public.favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select app.is_active_user())
    and exists (
      select 1 from public.properties p
      where p.id = favorites.property_id
        and app.listing_visible(p.is_listed, p.published_at, p.expires_at)));

create policy favorites_delete_own on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- Enquiries are created only through create_enquiry().
grant select on public.enquiries to authenticated;

create policy enquiries_select_participant on public.enquiries for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or (select app.is_admin()));

-- Views are recorded only through record_property_view().
grant select, delete on public.recently_viewed to authenticated;

create policy recently_viewed_select_own on public.recently_viewed for select to authenticated
  using (user_id = (select auth.uid()));

create policy recently_viewed_delete_own on public.recently_viewed for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.notifications to authenticated;
grant update (status, read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

------------------------------------------------------------------------------
-- CMS
------------------------------------------------------------------------------

grant select on public.articles to anon, authenticated;

create policy articles_select on public.articles for select to anon, authenticated
  using (
    (status = 'published' and published_at <= now())
    or (select app.is_admin()));

-- admin_notes, audit_logs and notification_intents: RLS enabled, no client
-- grants and no policies. Server-only.

------------------------------------------------------------------------------
-- RPC allowlist
------------------------------------------------------------------------------

grant execute on function public.get_listing_seller(uuid) to anon, authenticated;

grant execute on function
  public.ensure_profile(),
  public.become_seller(text),
  public.transition_property(uuid, text, integer, uuid, text, text, uuid),
  public.delete_property_draft(uuid, integer),
  public.arrange_property_media(uuid, uuid[], uuid),
  public.remove_property_media(uuid),
  public.remove_property_document(uuid),
  public.create_enquiry(uuid, text, uuid),
  public.record_property_view(uuid),
  public.admin_change_role(uuid, text, boolean, text),
  public.admin_set_suspension(uuid, boolean, text),
  public.admin_set_featured(uuid, boolean, integer),
  public.admin_add_note(text, uuid, text)
to authenticated;

-- Server-only operations. The caller has already authenticated the user; the
-- functions still re-verify the actor's current state and ownership.
revoke execute on function
  public.consume_rate_limit(text, text),
  public.register_webhook_receipt(text, text),
  public.release_webhook_receipt(text, text),
  public.upload_session_release(uuid, uuid, uuid),
  public.upload_session_create(uuid, uuid, text, text, integer, text, text, text, integer, integer),
  public.upload_session_claim(uuid, uuid, integer),
  public.upload_session_finalize_media(uuid, uuid, uuid, uuid, text, text, text, text, integer, integer, integer, integer),
  public.upload_session_finalize_document(uuid, uuid, uuid, uuid, text, text, text, text, integer, integer),
  public.upload_session_fail(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.consume_rate_limit(text, text),
  public.register_webhook_receipt(text, text),
  public.release_webhook_receipt(text, text),
  public.upload_session_release(uuid, uuid, uuid),
  public.upload_session_create(uuid, uuid, text, text, integer, text, text, text, integer, integer),
  public.upload_session_claim(uuid, uuid, integer),
  public.upload_session_finalize_media(uuid, uuid, uuid, uuid, text, text, text, text, integer, integer, integer, integer),
  public.upload_session_finalize_document(uuid, uuid, uuid, uuid, text, text, text, text, integer, integer),
  public.upload_session_fail(uuid, uuid, uuid, text)
to service_role;
