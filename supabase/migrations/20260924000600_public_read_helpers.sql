-- Public read helpers and CMS author field.

-- Listing counts per location for the home page and location pages.
-- SECURITY INVOKER: runs under the caller's RLS, so it counts exactly the
-- listings that caller can see; the predicate also keeps the partial index.
create or replace function public.location_listing_counts()
returns table (location_id uuid, listings bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.location_id, count(*)
  from public.properties p
  where p.is_listed
    and p.published_at <= now()
    and (p.expires_at is null or p.expires_at > now())
  group by p.location_id
$$;

revoke all on function public.location_listing_counts() from public;
grant execute on function public.location_listing_counts() to anon, authenticated;

-- Guides show an author (continue.md phase 14). Public readers cannot read
-- profiles, so the display name is stored on the article.
alter table public.articles
  add column if not exists author_name text check (author_name is null or char_length(author_name) <= 100);

-- Seller inbox (ENQ, GAP-08 PROPOSED): the seller of a listing sees the name
-- and phone of buyers who enquired about it. Buyers are told this in the
-- enquiry dialog. Nobody else can read buyer contact details.
create or replace function public.list_received_enquiries(p_status text, p_limit integer, p_offset integer)
returns table (
  id uuid, property_id uuid, property_title text, property_slug text, property_status text,
  buyer_name text, buyer_phone text, message text, status text, created_at timestamptz, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  if not app.actor_is_active(v_actor) then
    perform app.fail('ACCOUNT_SUSPENDED');
  end if;
  return query
    select e.id, e.property_id, p.title, p.slug, p.status, b.full_name, b.phone, e.message, e.status, e.created_at,
           count(*) over () as total
    from public.enquiries e
    join public.properties p on p.id = e.property_id
    join public.profiles b on b.id = e.buyer_id
    where e.seller_id = v_actor
      and (p_status is null or e.status = p_status)
    order by e.created_at desc, e.id desc
    limit least(greatest(p_limit, 1), 100)
    offset greatest(p_offset, 0);
end;
$$;

-- Per-listing enquiry counts for the seller's own listings (seller analytics).
create or replace function public.seller_enquiry_counts()
returns table (property_id uuid, total bigint, unread bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.property_id, count(*), count(*) filter (where e.status = 'new')
  from public.enquiries e
  where e.seller_id = (select auth.uid())
  group by e.property_id
$$;

revoke all on function public.list_received_enquiries(text, integer, integer), public.seller_enquiry_counts() from public, anon;
grant execute on function public.list_received_enquiries(text, integer, integer), public.seller_enquiry_counts() to authenticated;

-- Seller dashboard KPI cards: one grouped count over the caller's listings.
create or replace function public.my_listing_status_counts()
returns table (status text, listings bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.status, count(*)
  from public.properties p
  where p.owner_id = (select auth.uid()) and p.deleted_at is null
  group by p.status
$$;

revoke all on function public.my_listing_status_counts() from public, anon;
grant execute on function public.my_listing_status_counts() to authenticated;
