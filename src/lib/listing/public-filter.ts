// The public eligibility predicate (GAP-02) for queries made with a user
// session. Anonymous queries get it from RLS alone; a signed-in user's RLS
// also allows their own and (for admins) all listings, and that OR prevents
// Postgres from using the `where is_listed` partial indexes. Every public
// surface (search, home, location, similar, sitemap) must apply this so it
// shows exactly what a visitor sees and keeps index-backed plans.
//
// Mirrors app.listing_visible(); tests/db/inventory.test.ts asserts the plan.

interface FilterableQuery<Q> {
  eq(column: string, value: unknown): Q;
  lte(column: string, value: string): Q;
  or(filters: string): Q;
}

export function onlyPubliclyListed<Q extends FilterableQuery<Q>>(query: Q, now: Date = new Date()): Q {
  const iso = now.toISOString();
  return query.eq("is_listed", true).lte("published_at", iso).or(`expires_at.is.null,expires_at.gt.${iso}`);
}
