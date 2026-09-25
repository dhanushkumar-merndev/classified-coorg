-- Listing photo rules (product decision 2026-09-25): at least 4 photos, of
-- which at least one portrait and one landscape. Orientation uses the stored
-- (EXIF-corrected, re-encoded) dimensions; long ÷ short >= 1.2 counts.
-- Mirrors src/lib/media/photo-rules.ts — keep both in sync.

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
    case when (select total from photos) < 4 then 'photos' end,
    case when (select portrait from photos) < 1 then 'photo_portrait' end,
    case when (select landscape from photos) < 1 then 'photo_landscape' end,
    case when not coalesce((select has_cover from photos), false) then 'cover_photo' end,
    case when not exists (
      select 1 from public.property_documents d where d.property_id = p.id and d.removed_at is null) then 'documents' end,
    case when exists (
      select 1 from app.upload_sessions s
      where s.property_id = p.id and s.state in ('initiated', 'processing') and s.expires_at > now()) then 'uploads_in_progress' end
  ], null)
$$;
