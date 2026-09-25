-- Product decision (2026-09-25): listings may show the seller's name and type
-- (owner / agent / developer), never contact details. get_listing_seller
-- returns only display name, seller type and member-since. Exact address and
-- coordinates stay private (they would let a buyer bypass the platform).

grant execute on function public.get_listing_seller(uuid) to anon, authenticated;
grant select (seller_type) on public.properties to anon;
