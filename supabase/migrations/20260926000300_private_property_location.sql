-- Signed-in buyers must not be able to bypass the broker through the REST API.
-- Owners/admins read exact location only through the authorized server helper.
-- Stored addresses and coordinates, and existing owner write access, are preserved.
revoke select on public.properties from authenticated;
revoke select (address_text, latitude, longitude) on public.properties from authenticated;

do $$
declare
  readable_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into readable_columns
  from pg_attribute
  where attrelid = 'public.properties'::regclass and attnum > 0 and not attisdropped
    and attname not in ('address_text', 'latitude', 'longitude');
  execute 'grant select (' || readable_columns || ') on public.properties to authenticated';
end;
$$;

-- Only supported public amenities/features are visible to buyers. Legacy
-- distance/directions and unknown keys remain available to the owner and team.
drop policy property_features_select on public.property_features;
create policy property_features_select_public on public.property_features for select to anon, authenticated
  using (
    feature_key in (
      'borewell', 'stream_or_river', 'pond', 'farmhouse', 'labour_quarters', 'power_backup',
      'plantation_type', 'fenced', 'drying_yard', 'view', 'shade_trees', 'pepper_vines',
      'fruit_trees', 'irrigation', 'coffee_pulping_unit', 'storage_shed', 'vehicle_access', 'level_land')
    and exists (select 1 from public.properties p where p.id = property_features.property_id));
create policy property_features_select_private on public.property_features for select to authenticated
  using (
    (select app.is_admin()) or exists (
      select 1 from public.properties p
      where p.id = property_features.property_id and p.owner_id = (select auth.uid())));
