-- Product decision (2026-09-25, final): the public never sees the seller's
-- name either. Seller type (owner / agent / developer) stays visible; contact
-- details, name, exact address and coordinates do not.

revoke execute on function public.get_listing_seller(uuid) from anon, authenticated;
