-- Initial Coorg locations (continue.md phase 13). Hierarchy below the district
-- is kept flat until Product confirms taluk/village structure (GAP-15).

insert into public.locations (type, name, slug, sort_order)
values ('district', 'Coorg', 'coorg', 0)
on conflict (slug) do nothing;

insert into public.locations (parent_id, type, name, slug, sort_order)
select d.id, v.type, v.name, v.slug, v.sort_order
from public.locations d
cross join (values
  ('town', 'Madikeri', 'madikeri', 1),
  ('town', 'Kushalnagar', 'kushalnagar', 2),
  ('town', 'Virajpet', 'virajpet', 3),
  ('town', 'Somwarpet', 'somwarpet', 4),
  ('town', 'Gonikoppal', 'gonikoppal', 5),
  ('town', 'Suntikoppa', 'suntikoppa', 6),
  ('village', 'Boikere', 'boikere', 7),
  ('town', 'Napoklu', 'napoklu', 8)
) as v (type, name, slug, sort_order)
where d.slug = 'coorg'
on conflict (slug) do nothing;
