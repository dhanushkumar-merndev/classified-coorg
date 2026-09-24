import "server-only";
import { unstable_cache } from "next/cache";
import { AREA_TO_SQFT } from "@/lib/area";
import { logger } from "@/lib/logger";
import { createPublicClient } from "@/lib/supabase/server";
import { MAX_PAGE, PAGE_SIZE, type SearchFilters } from "@/schemas/search.schema";

// Public read model. Every query uses the anonymous client, so what appears
// is decided by RLS's public eligibility predicate (GAP-02) and the same
// result is safe to cache for everyone. Cards select only card columns and
// the cover photo (architecture §33).

export const CACHE_TAGS = {
  listings: "listings",
  listing: (id: string) => `listing:${id}`,
  locations: "locations",
  articles: "articles",
} as const;

const PUBLIC_TTL_SECONDS = 300;

const CARD_COLUMNS = `
  id, slug, title, price, price_per_unit, area_value, area_unit, property_type, seller_type,
  listing_type, published_at, featured,
  location:locations(name, slug),
  cover:property_media(id, alt_text)
`;

export interface ListingCard {
  id: string;
  slug: string;
  title: string;
  price: number;
  price_per_unit: number | null;
  area_value: number;
  area_unit: string;
  property_type: string;
  seller_type: string;
  listing_type: string;
  published_at: string;
  featured: boolean;
  location: { name: string; slug: string } | null;
  coverId: string | null;
  coverAlt: string | null;
}

export type RawCard = Omit<ListingCard, "coverId" | "coverAlt"> & { cover: Array<{ id: string; alt_text: string | null }> | null };

export function toCard(row: RawCard): ListingCard {
  const { cover, ...rest } = row;
  return { ...rest, coverId: cover?.[0]?.id ?? null, coverAlt: cover?.[0]?.alt_text ?? null };
}

export interface LocationRow {
  id: string;
  parent_id: string | null;
  type: string;
  name: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  intro: string | null;
  sort_order: number;
}

export const getLocations = unstable_cache(
  async (): Promise<LocationRow[]> => {
    const { data, error } = await createPublicClient()
      .from("locations")
      .select("id, parent_id, type, name, slug, seo_title, seo_description, intro, sort_order")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
  ["public-locations"],
  { tags: [CACHE_TAGS.locations], revalidate: PUBLIC_TTL_SECONDS },
);

/** A location and all of its descendants (Coorg → towns → villages). */
export function descendantIds(locations: LocationRow[], rootSlug: string): string[] {
  const root = locations.find((l) => l.slug === rootSlug);
  if (!root) return [];
  const ids = [root.id];
  for (let i = 0; i < ids.length && ids.length < 500; i++) {
    for (const l of locations) if (l.parent_id === ids[i]) ids.push(l.id);
  }
  return ids;
}

export interface SearchResult {
  items: ListingCard[];
  total: number;
  page: number;
  pageCount: number;
}

async function runSearch(filters: SearchFilters): Promise<SearchResult> {
  const page = Math.min(filters.page, MAX_PAGE);
  const supabase = createPublicClient();

  const withPlantation = Boolean(filters.plantation);
  const select = withPlantation ? `${CARD_COLUMNS}, pf:property_features!inner(feature_key, feature_value)` : CARD_COLUMNS;
  let query = supabase.from("properties").select(select, { count: "exact" }).eq("cover.is_cover", true).is("cover.removed_at", null);

  if (filters.location) {
    const ids = descendantIds(await getLocations(), filters.location);
    if (ids.length === 0) return { items: [], total: 0, page, pageCount: 0 };
    query = query.in("location_id", ids);
  }
  if (filters.type) query = query.eq("property_type", filters.type);
  if (filters.seller) query = query.eq("seller_type", filters.seller);
  if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);
  const factor = AREA_TO_SQFT[filters.unit];
  if (filters.minArea !== undefined) query = query.gte("area_sqft", filters.minArea * factor);
  if (filters.maxArea !== undefined) query = query.lte("area_sqft", filters.maxArea * factor);
  if (filters.road) query = query.eq("road_access", true);
  if (filters.water) query = query.eq("water_available", true);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);
  if (withPlantation) {
    query = query.eq("pf.feature_key", "plantation_type").ilike("pf.feature_value", `%${escapeLike(filters.plantation!)}%`);
  }

  switch (filters.sort) {
    case "price_asc": query = query.order("price", { ascending: true }).order("id"); break;
    case "price_desc": query = query.order("price", { ascending: false }).order("id", { ascending: false }); break;
    case "area_asc": query = query.order("area_sqft", { ascending: true }).order("id"); break;
    case "area_desc": query = query.order("area_sqft", { ascending: false }).order("id", { ascending: false }); break;
    default: query = query.order("published_at", { ascending: false }).order("id", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    // Offset past the end returns 416 from PostgREST: treat as empty.
    if (error.code === "PGRST103") return { items: [], total: count ?? 0, page, pageCount: 0 };
    logger.error("search.failed", { code: error.code, message: error.message });
    throw error;
  }
  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as RawCard[]).map(toCard),
    total,
    page,
    pageCount: Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGE),
  };
}

export const searchListings = unstable_cache(runSearch, ["public-search"], {
  tags: [CACHE_TAGS.listings],
  revalidate: PUBLIC_TTL_SECONDS,
});

function escapeLike(value: string): string {
  return value.replace(/[\\%_,()]/g, (c) => `\\${c}`);
}

export const getFeaturedListings = unstable_cache(
  async (limit: number): Promise<ListingCard[]> => {
    const { data, error } = await createPublicClient()
      .from("properties")
      .select(CARD_COLUMNS)
      .eq("featured", true)
      .eq("cover.is_cover", true)
      .is("cover.removed_at", null)
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as unknown as RawCard[]).map(toCard);
  },
  ["public-featured"],
  { tags: [CACHE_TAGS.listings], revalidate: PUBLIC_TTL_SECONDS },
);

export const getLocationCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const { data, error } = await createPublicClient().rpc("location_listing_counts");
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as Array<{ location_id: string; listings: number }>).map((r) => [r.location_id, Number(r.listings)]));
  },
  ["public-location-counts"],
  { tags: [CACHE_TAGS.listings, CACHE_TAGS.locations], revalidate: PUBLIC_TTL_SECONDS },
);

export interface ListingDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  property_type: string;
  listing_type: string;
  seller_type: string;
  price: number;
  negotiable: boolean;
  area_value: number;
  area_unit: string;
  price_per_unit: number | null;
  address_text: string | null;
  latitude: number | null;
  longitude: number | null;
  road_access: boolean | null;
  water_available: boolean | null;
  electricity_available: boolean | null;
  featured: boolean;
  published_at: string;
  updated_at: string;
  location: { id: string; name: string; slug: string; parent_id: string | null } | null;
  media: Array<{ id: string; alt_text: string | null; sort_order: number; is_cover: boolean; width: number; height: number }>;
  features: Array<{ feature_key: string; feature_value: string | null }>;
}

const DETAIL_COLUMNS = `
  id, slug, title, description, property_type, listing_type, seller_type, price, negotiable,
  area_value, area_unit, price_per_unit, address_text, latitude, longitude, road_access,
  water_available, electricity_available, featured, published_at, updated_at,
  location:locations(id, name, slug, parent_id),
  media:property_media(id, alt_text, sort_order, is_cover, width, height),
  features:property_features(feature_key, feature_value)
`;

export type SlugLookup = { kind: "found"; listing: ListingDetail } | { kind: "redirect"; slug: string } | { kind: "missing" };

export const getListingBySlug = unstable_cache(
  async (slug: string): Promise<SlugLookup> => {
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) return { kind: "missing" };
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("properties")
      .select(DETAIL_COLUMNS)
      .eq("slug", slug)
      .is("media.removed_at", null)
      .order("sort_order", { referencedTable: "media" })
      .maybeSingle();
    if (error) throw error;
    if (data) return { kind: "found", listing: data as unknown as ListingDetail };

    // Old slug → current canonical slug, only if that listing is public (LIFE-007).
    const { data: history } = await supabase
      .from("property_slug_history")
      .select("property:properties(slug)")
      .eq("old_slug", slug)
      .maybeSingle();
    const current = (history?.property as unknown as { slug: string } | null)?.slug;
    return current && current !== slug ? { kind: "redirect", slug: current } : { kind: "missing" };
  },
  ["public-listing-by-slug"],
  { tags: [CACHE_TAGS.listings], revalidate: PUBLIC_TTL_SECONDS },
);

export const getSimilarListings = unstable_cache(
  async (listingId: string, locationId: string | null, propertyType: string): Promise<ListingCard[]> => {
    let query = createPublicClient()
      .from("properties")
      .select(CARD_COLUMNS)
      .neq("id", listingId)
      .eq("cover.is_cover", true)
      .is("cover.removed_at", null);
    query = locationId
      ? query.or(`location_id.eq.${locationId},property_type.eq.${propertyType}`)
      : query.eq("property_type", propertyType);
    const { data, error } = await query.order("published_at", { ascending: false }).order("id", { ascending: false }).limit(4);
    if (error) throw error;
    return ((data ?? []) as unknown as RawCard[]).map(toCard);
  },
  ["public-similar"],
  { tags: [CACHE_TAGS.listings], revalidate: PUBLIC_TTL_SECONDS },
);

export const getListingSeller = unstable_cache(
  async (listingId: string): Promise<{ display_name: string; seller_type: string; member_since: string } | null> => {
    const { data, error } = await createPublicClient().rpc("get_listing_seller", { p_property_id: listingId });
    if (error) throw error;
    return (data as { display_name: string; seller_type: string; member_since: string } | null) ?? null;
  },
  ["public-listing-seller"],
  { tags: [CACHE_TAGS.listings], revalidate: PUBLIC_TTL_SECONDS },
);

/** Sitemap: every public listing slug, paged in bounded chunks. */
export async function getListingSlugsForSitemap(offset: number, limit: number) {
  const { data, error } = await createPublicClient()
    .from("properties")
    .select("slug, updated_at")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string;
  updated_at: string;
}

export const getPublishedArticles = unstable_cache(
  async (limit: number): Promise<ArticleSummary[]> => {
    const { data, error } = await createPublicClient()
      .from("articles")
      .select("id, slug, title, excerpt, published_at, updated_at")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },
  ["public-articles"],
  { tags: [CACHE_TAGS.articles], revalidate: PUBLIC_TTL_SECONDS },
);

export const getArticleBySlug = unstable_cache(
  async (slug: string) => {
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
    const { data, error } = await createPublicClient()
      .from("articles")
      .select("id, slug, title, excerpt, body, seo_title, seo_description, author_name, published_at, updated_at")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  ["public-article"],
  { tags: [CACHE_TAGS.articles], revalidate: PUBLIC_TTL_SECONDS },
);
