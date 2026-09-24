-- Core schema: identity, roles, locations, listings and their children.
--
-- Conventions
--   * Enumerations are text + CHECK so a value list change is a reviewed migration,
--     not an enum rewrite. Values marked PROPOSED follow test.md §2 baselines
--     (GAP-03) and must be confirmed by Product before release.
--   * `app` is a private schema (not exposed through PostgREST). It holds
--     internal tables and helper functions used by RLS policies.
--   * Every SECURITY DEFINER function pins `search_path = ''` and fully
--     qualifies every object.

create schema if not exists app;
revoke all on schema app from public;

-- Functions are not executable by PUBLIC unless a later migration grants it.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app revoke execute on functions from public;

------------------------------------------------------------------------------
-- Generic helpers
------------------------------------------------------------------------------

-- Raise a domain error. The message is a stable application error code that
-- src/lib/errors.ts maps to an HTTP status; the detail is safe to show.
create or replace function app.fail(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'IMMUTABLE_RECORD',
    detail = tg_table_name || ' rows are append-only';
end;
$$;

-- ASCII slug. Non-Latin titles (e.g. Kannada) collapse to an empty base, which
-- callers replace with a neutral prefix; the UUID suffix keeps slugs unique.
create or replace function app.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), '-'),
    80)
$$;

------------------------------------------------------------------------------
-- Identity and roles
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 100),
  -- E.164, mirrored from auth.users.phone by trigger. Never accepted from clients
  -- as identity proof (GAP-07).
  phone text unique check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$')),
  -- Descriptive only. Authorization always uses user_roles (GAP-04).
  user_type text not null default 'buyer' check (user_type in ('buyer', 'owner', 'agent', 'developer')),
  avatar_object_key text,
  is_suspended boolean not null default false,
  suspended_at timestamptz,
  suspension_reason text check (suspension_reason is null or char_length(suspension_reason) <= 500),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_suspended = (suspended_at is not null))
);

create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

create table public.roles (
  id smallint primary key,
  name text not null unique check (name in ('buyer', 'seller', 'agent', 'admin', 'super_admin'))
);

insert into public.roles (id, name) values
  (1, 'buyer'), (2, 'seller'), (3, 'agent'), (4, 'admin'), (5, 'super_admin');

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id smallint not null references public.roles (id),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_role_idx on public.user_roles (role_id, user_id);

------------------------------------------------------------------------------
-- Actor helpers. Current state is always read from the database, never from
-- JWT claims, so suspension and role removal apply to already-issued tokens
-- (RLS-008, AUTH-010). Policies call the no-argument variants wrapped in
-- `(select ...)` so Postgres evaluates them once per statement (InitPlan).
------------------------------------------------------------------------------

create or replace function app.actor_is_active(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_actor and not p.is_suspended and p.deleted_at is null)
$$;

create or replace function app.actor_has_any_role(p_actor uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = p_actor
      and r.name = any (p_roles)
      and not p.is_suspended
      and p.deleted_at is null)
$$;

create or replace function app.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.actor_is_active(auth.uid())
$$;

create or replace function app.has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.actor_has_any_role(auth.uid(), p_roles)
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.actor_has_any_role(auth.uid(), array['admin', 'super_admin'])
$$;

------------------------------------------------------------------------------
-- Locations (GAP-15: hierarchy, no cycles)
------------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations (id) on delete restrict,
  type text not null check (type in ('district', 'taluk', 'town', 'village', 'area')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 170),
  intro text check (intro is null or char_length(intro) <= 5000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create index locations_parent_idx on public.locations (parent_id);

create trigger locations_touch before update on public.locations
  for each row execute function app.touch_updated_at();

create or replace function app.locations_prevent_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if exists (
    with recursive ancestors (id, depth) as (
      select l.parent_id, 1 from public.locations l where l.id = new.parent_id
      union all
      select l.parent_id, a.depth + 1
      from public.locations l join ancestors a on l.id = a.id
      where a.id is not null and a.depth < 32
    )
    select 1 from ancestors where id = new.id
  ) or new.parent_id = new.id then
    perform app.fail('LOCATION_HIERARCHY_CYCLE');
  end if;
  return new;
end;
$$;

create trigger locations_no_cycle before insert or update of parent_id on public.locations
  for each row execute function app.locations_prevent_cycle();

------------------------------------------------------------------------------
-- Properties
------------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),

  -- Draft content. Columns are nullable so autosave can persist partial drafts;
  -- completeness is enforced when the listing is submitted.
  title text check (title is null or char_length(title) <= 120),
  description text check (description is null or char_length(description) <= 5000),
  -- PROPOSED value lists (GAP-03).
  property_type text check (property_type in (
    'coffee_estate', 'agricultural_land', 'farm_land', 'residential_plot',
    'commercial_land', 'house_villa', 'homestay_resort', 'other')),
  listing_type text not null default 'sale' check (listing_type in ('sale', 'lease')),
  seller_type text check (seller_type in ('owner', 'agent', 'developer')),
  price numeric(14, 2) check (price > 0),
  negotiable boolean not null default false,
  area_value numeric(14, 4) check (area_value > 0),
  area_unit text check (area_unit in ('sqft', 'sqm', 'cent', 'guntha', 'acre', 'hectare')),
  location_id uuid references public.locations (id) on delete restrict,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  address_text text check (address_text is null or char_length(address_text) <= 300),
  road_access boolean,
  water_available boolean,
  electricity_available boolean,

  -- Lifecycle (architecture §30). Changed only through transition_property().
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'changes_required',
    'rejected', 'verified', 'sold', 'archived')),
  featured boolean not null default false,
  published_at timestamptz,
  first_published_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  current_revision_id uuid,
  version integer not null default 1,

  -- Denormalized from profiles/locations by trigger so the public predicate is
  -- row-local and indexable instead of a per-row lookup.
  owner_suspended boolean not null default false,
  location_active boolean not null default true,

  -- Derived fields. verification_status cannot contradict status (GAP-13).
  verification_status text generated always as (
    case status
      when 'draft' then 'unverified'
      when 'submitted' then 'pending'
      when 'under_review' then 'pending'
      when 'changes_required' then 'changes_required'
      when 'rejected' then 'rejected'
      else 'verified'
    end) stored,
  area_sqft numeric generated always as (
    area_value * case area_unit
      when 'sqft' then 1
      when 'sqm' then 10.7639104
      when 'cent' then 435.6
      when 'guntha' then 1089
      when 'acre' then 43560
      when 'hectare' then 107639.104
    end) stored,
  price_per_unit numeric(16, 2) generated always as (
    case when area_value > 0 then round(price / area_value, 2) end) stored,
  -- Time-independent half of the public eligibility predicate (GAP-02).
  -- The time-dependent half lives in app.listing_visible().
  is_listed boolean generated always as (
    status = 'verified'
    and deleted_at is null
    and published_at is not null
    and not owner_suspended
    and location_active) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check ((status = 'verified') <= (published_at is not null)),
  check (published_at is null or status in ('verified', 'sold', 'archived')),
  check (expires_at is null or published_at is null or expires_at > published_at),
  check (version > 0)
);

-- The single public eligibility predicate (GAP-02). LANGUAGE sql, no SET
-- clause and no SECURITY DEFINER so the planner inlines it into policies and
-- queries rather than calling a function per row. Keep `p_is_listed` bare
-- (no coalesce): the planner must see the literal `is_listed` qual to match
-- the `where is_listed` partial indexes. is_listed is never null.
create or replace function app.listing_visible(
  p_is_listed boolean, p_published_at timestamptz, p_expires_at timestamptz)
returns boolean
language sql
stable
as $$
  select p_is_listed
    and p_published_at <= now()
    and (p_expires_at is null or p_expires_at > now())
$$;

-- Public feed / search indexes (architecture §18), partial on listed rows.
create index properties_listed_recent_idx on public.properties (published_at desc, id desc) where is_listed;
create index properties_listed_location_idx on public.properties (location_id, published_at desc, id desc) where is_listed;
create index properties_listed_type_idx on public.properties (property_type, published_at desc, id desc) where is_listed;
create index properties_listed_price_idx on public.properties (price, id) where is_listed;
create index properties_listed_area_idx on public.properties (area_sqft, id) where is_listed;
create index properties_listed_featured_idx on public.properties (published_at desc, id desc) where is_listed and featured;
create index properties_owner_idx on public.properties (owner_id, updated_at desc);
create index properties_review_queue_idx on public.properties (status, updated_at) where status in ('submitted', 'under_review');
create index properties_expiry_idx on public.properties (expires_at) where is_listed and expires_at is not null;

create table public.property_slug_history (
  old_slug text primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index property_slug_history_property_idx on public.property_slug_history (property_id);

-- Immutable snapshot of exactly what was submitted for review (GAP-09).
create table public.property_revisions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  revision_no integer not null check (revision_no > 0),
  snapshot jsonb not null,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (property_id, revision_no)
);

alter table public.properties
  add constraint properties_current_revision_fk
  foreign key (current_revision_id) references public.property_revisions (id) on delete restrict;

create trigger property_revisions_immutable before update or delete on public.property_revisions
  for each row execute function app.prevent_mutation();

create table public.property_status_history (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete restrict,
  from_status text not null,
  to_status text not null,
  action text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  revision_id uuid references public.property_revisions (id) on delete restrict,
  reason text check (reason is null or char_length(reason) <= 2000),
  request_id uuid,
  created_at timestamptz not null default now(),
  unique (property_id, request_id)
);

create index property_status_history_property_idx on public.property_status_history (property_id, created_at desc);

create trigger property_status_history_immutable before update or delete on public.property_status_history
  for each row execute function app.prevent_mutation();

-- Content columns an owner may edit. Kept in one place for the edit-lock trigger.
create or replace function app.property_content_changed(o public.properties, n public.properties)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (o.title, o.description, o.property_type, o.listing_type, o.seller_type,
          o.price, o.negotiable, o.area_value, o.area_unit, o.location_id,
          o.latitude, o.longitude, o.address_text, o.road_access,
          o.water_available, o.electricity_available)
    is distinct from
         (n.title, n.description, n.property_type, n.listing_type, n.seller_type,
          n.price, n.negotiable, n.area_value, n.area_unit, n.location_id,
          n.latitude, n.longitude, n.address_text, n.road_access,
          n.water_available, n.electricity_available)
$$;

create or replace function app.property_slug(p_title text, p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(app.slugify(p_title), ''), 'property')
         || '-' || left(replace(p_id::text, '-', ''), 10)
$$;

create or replace function app.properties_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit record;
begin
  if tg_op = 'INSERT' then
    select * into v_limit from app.rate_limit_consume('property_create', new.owner_id::text);
    if not v_limit.allowed then
      perform app.fail('RATE_LIMITED', v_limit.retry_after_seconds::text);
    end if;
    new.id := coalesce(new.id, gen_random_uuid());
    new.status := 'draft';
    new.version := 1;
    new.featured := false;
    new.published_at := null;
    new.first_published_at := null;
    new.deleted_at := null;
    new.current_revision_id := null;
    new.slug := app.property_slug(new.title, new.id);
  else
    if new.owner_id is distinct from old.owner_id or new.id <> old.id then
      perform app.fail('IMMUTABLE_FIELD', 'owner_id');
    end if;
    -- GAP-01 baseline: listing content is editable only in draft and
    -- changes_required. This holds for every caller, including service role.
    if app.property_content_changed(old, new)
       and (old.status not in ('draft', 'changes_required') or old.deleted_at is not null) then
      perform app.fail('PROPERTY_NOT_EDITABLE', old.status);
    end if;
    if new.title is distinct from old.title then
      new.slug := app.property_slug(new.title, new.id);
      if old.first_published_at is not null and new.slug <> old.slug then
        insert into public.property_slug_history (old_slug, property_id)
        values (old.slug, old.id) on conflict (old_slug) do nothing;
      end if;
    end if;
    -- Version changes on every meaningful write; propagation of seller
    -- suspension / location activity must not break an editor's version.
    if app.property_content_changed(old, new)
       or (new.status, new.featured, new.published_at, new.expires_at, new.deleted_at, new.current_revision_id)
          is distinct from
          (old.status, old.featured, old.published_at, old.expires_at, old.deleted_at, old.current_revision_id) then
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' or new.location_id is distinct from old.location_id then
    new.location_active := coalesce(
      (select l.is_active from public.locations l where l.id = new.location_id), true);
  end if;
  if tg_op = 'INSERT' then
    new.owner_suspended := coalesce(
      (select p.is_suspended or p.deleted_at is not null from public.profiles p where p.id = new.owner_id), true);
  end if;
  return new;
end;
$$;

create trigger properties_before_write before insert or update on public.properties
  for each row execute function app.properties_before_write();

create or replace function app.sync_owner_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.is_suspended, new.deleted_at is null) is distinct from (old.is_suspended, old.deleted_at is null) then
    update public.properties
       set owner_suspended = (new.is_suspended or new.deleted_at is not null)
     where owner_id = new.id;
  end if;
  return null;
end;
$$;

create trigger profiles_sync_owner_suspension after update of is_suspended, deleted_at on public.profiles
  for each row execute function app.sync_owner_suspension();

create or replace function app.sync_location_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active then
    update public.properties set location_active = new.is_active where location_id = new.id;
  end if;
  return null;
end;
$$;

create trigger locations_sync_active after update of is_active on public.locations
  for each row execute function app.sync_location_active();

------------------------------------------------------------------------------
-- Property children
------------------------------------------------------------------------------

-- A media row exists only for a finalized, validated object (architecture §13
-- step 6). Upload progress lives in app.upload_sessions.
create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  media_type text not null default 'image' check (media_type = 'image'),
  storage_bucket text not null,
  storage_path text not null unique check (storage_path !~ '^quarantine/'),
  thumbnail_path text not null unique check (thumbnail_path !~ '^quarantine/'),
  object_version text,
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  upload_state text not null default 'ready' check (upload_state = 'ready'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size > 0),
  alt_text text check (alt_text is null or char_length(alt_text) <= 200),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_cover boolean not null default false,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  check (not (is_cover and removed_at is not null))
);

create unique index property_media_one_cover_idx on public.property_media (property_id) where is_cover and removed_at is null;
create index property_media_property_idx on public.property_media (property_id, sort_order) where removed_at is null;

create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  -- PROPOSED Karnataka land-record types (GAP-03).
  document_type text not null check (document_type in (
    'title_deed', 'rtc', 'encumbrance_certificate', 'khata', 'tax_receipt',
    'survey_sketch', 'conversion_order', 'other')),
  storage_bucket text not null,
  storage_path text not null unique check (storage_path !~ '^quarantine/'),
  object_version text,
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  upload_state text not null default 'ready' check (upload_state = 'ready'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/webp')),
  byte_size integer not null check (byte_size > 0),
  original_filename text check (original_filename is null or char_length(original_filename) <= 200),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'accepted', 'rejected')),
  admin_comment text check (admin_comment is null or char_length(admin_comment) <= 2000),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create index property_documents_property_idx on public.property_documents (property_id) where removed_at is null;

create table public.property_features (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  feature_value text check (feature_value is null or char_length(feature_value) <= 200),
  unique (property_id, feature_key)
);

-- Listing children follow the same review lock as listing content (GAP-01,
-- DOC-005, MEDIA-009), for every caller.
create or replace function app.property_child_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property_id uuid := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
  v_status text;
  v_deleted timestamptz;
begin
  if tg_op = 'UPDATE' and new.property_id <> old.property_id then
    perform app.fail('IMMUTABLE_FIELD', 'property_id');
  end if;
  select p.status, p.deleted_at into v_status, v_deleted
    from public.properties p where p.id = v_property_id;
  if v_status is null then
    perform app.fail('PROPERTY_NOT_FOUND');
  end if;
  if v_status not in ('draft', 'changes_required') or v_deleted is not null then
    perform app.fail('PROPERTY_NOT_EDITABLE', v_status);
  end if;
  if tg_table_name = 'property_features' and tg_op = 'INSERT'
     and (select count(*) from public.property_features f where f.property_id = v_property_id) >= 50 then
    perform app.fail('LIMIT_REACHED', 'property_features');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger property_media_guard before insert or update or delete on public.property_media
  for each row execute function app.property_child_guard();
create trigger property_documents_guard before insert or update or delete on public.property_documents
  for each row execute function app.property_child_guard();
create trigger property_features_guard before insert or update or delete on public.property_features
  for each row execute function app.property_child_guard();

------------------------------------------------------------------------------
-- Buyer interactions
------------------------------------------------------------------------------

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index favorites_user_recent_idx on public.favorites (user_id, created_at desc);
create index favorites_property_idx on public.favorites (property_id);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  seller_id uuid not null references public.profiles (id) on delete restrict,
  message text check (message is null or char_length(message) between 1 and 1000),
  -- PROPOSED status set (GAP-08).
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, idempotency_key),
  check (buyer_id <> seller_id)
);

create index enquiries_seller_recent_idx on public.enquiries (seller_id, created_at desc);
create index enquiries_buyer_recent_idx on public.enquiries (buyer_id, created_at desc);
create index enquiries_property_idx on public.enquiries (property_id);

create trigger enquiries_touch before update on public.enquiries
  for each row execute function app.touch_updated_at();

create table public.recently_viewed (
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index recently_viewed_user_recent_idx on public.recently_viewed (user_id, viewed_at desc);

------------------------------------------------------------------------------
-- Moderation, audit and notifications
------------------------------------------------------------------------------

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  revision_id uuid not null references public.property_revisions (id) on delete restrict,
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  -- Shown to the owner (DOC-006).
  owner_message text check (owner_message is null or char_length(owner_message) <= 2000),
  -- Never shown to the owner.
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  created_at timestamptz not null default now()
);

create index verification_reviews_property_idx on public.verification_reviews (property_id, created_at desc);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('property', 'user', 'enquiry')),
  entity_id uuid not null,
  admin_id uuid references public.profiles (id) on delete set null,
  note text not null check (char_length(btrim(note)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index admin_notes_entity_idx on public.admin_notes (entity_type, entity_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  request_id text check (request_id is null or char_length(request_id) <= 100),
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_recent_idx on public.audit_logs (created_at desc);

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function app.prevent_mutation();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (char_length(type) <= 60),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'sms')),
  title text not null check (char_length(title) <= 200),
  body text check (body is null or char_length(body) <= 2000),
  status text not null default 'unread' check (status in ('unread', 'read')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_recent_idx on public.notifications (user_id, created_at desc);

-- Durable delivery intent written in the same transaction as the business
-- change (GAP-12). A bounded worker dispatches pending rows later.
create table public.notification_intents (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'welcome', 'listing_submitted', 'listing_approved', 'listing_rejected',
    'changes_requested', 'new_enquiry', 'listing_expiry', 'security_notice')),
  dedupe_key text not null unique check (char_length(dedupe_key) <= 200),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_intents_due_idx on public.notification_intents (next_attempt_at) where status in ('pending', 'failed');

create trigger notification_intents_touch before update on public.notification_intents
  for each row execute function app.touch_updated_at();

------------------------------------------------------------------------------
-- CMS
------------------------------------------------------------------------------

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  excerpt text check (excerpt is null or char_length(excerpt) <= 400),
  body text check (body is null or char_length(body) <= 100000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references public.profiles (id) on delete set null,
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 170),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') <= (published_at is not null))
);

create index articles_published_idx on public.articles (published_at desc, id desc) where status = 'published';

create trigger articles_touch before update on public.articles
  for each row execute function app.touch_updated_at();

------------------------------------------------------------------------------
-- Internal operational stores (private schema, no client grants)
------------------------------------------------------------------------------

-- PROPOSED limits (GAP-17). Tunable without a code change.
create table app.rate_limit_policies (
  action text primary key,
  max_hits integer not null check (max_hits > 0),
  window_seconds integer not null check (window_seconds > 0)
);

insert into app.rate_limit_policies (action, max_hits, window_seconds) values
  ('otp_send_phone_cooldown', 1, 60),
  ('otp_send_phone_hourly', 5, 3600),
  ('otp_send_phone_daily', 10, 86400),
  ('otp_request_ip', 20, 3600),
  ('otp_verify_phone', 5, 900),
  ('otp_verify_ip', 30, 900),
  ('enquiry_create', 10, 3600),
  ('property_create', 10, 86400),
  ('upload_initiate', 60, 3600),
  ('document_read', 120, 3600);

-- Fixed-window counters keyed by sha256(action:subject) so raw phone numbers
-- and IPs are not stored.
create table app.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

create index rate_limits_window_idx on app.rate_limits (window_start);

-- Replay guard for signed provider webhooks (SMS-002).
create table app.webhook_receipts (
  source text not null,
  id text not null check (char_length(id) <= 200),
  received_at timestamptz not null default now(),
  primary key (source, id)
);

create index webhook_receipts_received_idx on app.webhook_receipts (received_at);

create table app.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  kind text not null check (kind in ('property_image', 'property_document')),
  document_type text,
  bucket text not null,
  quarantine_key text not null unique check (quarantine_key ~ '^quarantine/'),
  declared_size integer not null check (declared_size > 0),
  declared_mime text not null,
  original_filename text check (original_filename is null or char_length(original_filename) <= 200),
  state text not null default 'initiated' check (state in ('initiated', 'processing', 'finalized', 'failed')),
  lease_until timestamptz,
  lease_token uuid,
  result_id uuid,
  error_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  check ((kind = 'property_document') = (document_type is not null))
);

create index upload_sessions_property_idx on app.upload_sessions (property_id, kind) where state in ('initiated', 'processing');
create index upload_sessions_cleanup_idx on app.upload_sessions (expires_at) where state in ('initiated', 'processing', 'failed');
