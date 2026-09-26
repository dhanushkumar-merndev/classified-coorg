-- Seller entry rules: amenities 3/6/9, features 6/8/10/12.
-- Drafts remain editable at any count. Existing published rows are untouched.
-- Catalog keys mirror src/lib/listing/details.ts; unknown and private keys do not count.

create or replace function app.property_submission_gaps(p public.properties)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with photos as (
    select
      count(*) as total,
      count(*) filter (where m.height >= m.width * 1.2) as portrait,
      count(*) filter (where m.width >= m.height * 1.2) as landscape,
      bool_or(m.is_cover) as has_cover
    from public.property_media m
    where m.property_id = p.id and m.removed_at is null
  ), details as (
    select
      coalesce(p.road_access::integer, 0) + coalesce(p.water_available::integer, 0)
        + coalesce(p.electricity_available::integer, 0)
        + count(*) filter (where f.feature_key in ('borewell', 'stream_or_river', 'pond', 'farmhouse', 'labour_quarters', 'power_backup')
          and f.feature_value = 'true') as amenities,
      count(*) filter (where
        (f.feature_key in ('plantation_type', 'view') and nullif(btrim(f.feature_value), '') is not null and btrim(f.feature_value) <> 'false')
        or (f.feature_key in ('fenced', 'drying_yard', 'shade_trees', 'pepper_vines', 'fruit_trees', 'irrigation',
          'coffee_pulping_unit', 'storage_shed', 'vehicle_access', 'level_land') and f.feature_value = 'true')) as features
    from public.property_features f where f.property_id = p.id
  )
  select array_remove(array[
    case when p.title is null or char_length(btrim(p.title)) < 10 then 'title' end,
    case when p.description is null or char_length(btrim(p.description)) < 50 then 'description' end,
    case when app.text_has_contact_details(coalesce(p.title, '') || ' ' || coalesce(p.description, '')) then 'contact_details' end,
    case when p.property_type is null then 'property_type' end,
    case when p.seller_type is null then 'seller_type' end,
    case when p.price is null then 'price' end,
    case when p.area_value is null or p.area_unit is null then 'area' end,
    case when p.location_id is null or not p.location_active then 'location' end,
    case when (select amenities from details) not in (3, 6, 9) then 'amenities' end,
    case when (select features from details) not in (6, 8, 10, 12) then 'features' end,
    case when (select total from photos) < 4 then 'photos' end,
    case when (select portrait from photos) < 1 then 'photo_portrait' end,
    case when (select landscape from photos) < 1 then 'photo_landscape' end,
    case when not coalesce((select has_cover from photos), false) then 'cover_photo' end,
    case when not exists (
      select 1 from public.property_documents d where d.property_id = p.id and d.removed_at is null) then 'documents' end,
    case when exists (
      select 1 from app.upload_sessions s
      where s.property_id = p.id and s.state in ('initiated', 'processing') and s.expires_at > now()) then 'uploads_in_progress' end,
    case when exists (
      select 1 from public.property_videos v
      where v.property_id = p.id and v.removed_at is null and v.state = 'processing') then 'video_processing' end
  ], null)
$$;
