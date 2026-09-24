import { z } from "zod";
import { AREA_UNITS, PROPERTY_TYPES, SELLER_TYPES } from "@/schemas/property.schema";

// Public search URL state (design §13–14, GAP-14). Every value is validated;
// anything malformed is dropped rather than failing the page, so shared or
// hand-edited URLs still render a sensible result.

export const SORTS = ["newest", "price_asc", "price_desc", "area_asc", "area_desc"] as const;
export type SortKey = (typeof SORTS)[number];

export const PAGE_SIZE = 24;
/** Offset budget: 400 pages × 24 = 9,600 rows (continue.md §25). */
export const MAX_PAGE = 400;

const int = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && /^\d{1,13}$/.test(v) ? Number(v) : undefined), z.number().int().min(0).max(max).optional());

const enumSlug = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/-/g, "_") : undefined),
    z.enum(values).optional(),
  );

const flag = z.preprocess((v) => v === "1" || v === "true", z.boolean());

export const searchParamsSchema = z.object({
  q: z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, 80) || undefined : undefined), z.string().optional()),
  location: z.preprocess((v) => (typeof v === "string" && /^[a-z0-9-]{1,100}$/.test(v) ? v : undefined), z.string().optional()),
  type: enumSlug(PROPERTY_TYPES),
  seller: enumSlug(SELLER_TYPES),
  minPrice: int(1e12),
  maxPrice: int(1e12),
  minArea: int(1e9),
  maxArea: int(1e9),
  unit: z.preprocess((v) => (typeof v === "string" ? v : "acre"), z.enum(AREA_UNITS).catch("acre")),
  road: flag,
  water: flag,
  plantation: z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, 40) || undefined : undefined), z.string().optional()),
  sort: z.preprocess((v) => (typeof v === "string" ? v : "newest"), z.enum(SORTS).catch("newest")),
  page: z.preprocess((v) => (typeof v === "string" && /^\d{1,6}$/.test(v) ? Number(v) : 1), z.number().int().min(1).catch(1)),
});

export type SearchFilters = z.infer<typeof searchParamsSchema>;

/** Next.js searchParams: take the first value of repeated keys. */
export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchFilters {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = searchParamsSchema.parse(flat);
  // Reversed bounds are swapped rather than returning nothing.
  if (parsed.minPrice !== undefined && parsed.maxPrice !== undefined && parsed.minPrice > parsed.maxPrice) {
    [parsed.minPrice, parsed.maxPrice] = [parsed.maxPrice, parsed.minPrice];
  }
  if (parsed.minArea !== undefined && parsed.maxArea !== undefined && parsed.minArea > parsed.maxArea) {
    [parsed.minArea, parsed.maxArea] = [parsed.maxArea, parsed.minArea];
  }
  return parsed;
}

/** Serializes filters back into a canonical query string (defaults omitted). */
export function toQueryString(filters: Partial<SearchFilters>, overrides: Partial<SearchFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    params.set(key, value === true ? "1" : String(value));
  };
  put("q", merged.q);
  put("location", merged.location);
  put("type", merged.type?.replace(/_/g, "-"));
  put("seller", merged.seller);
  put("minPrice", merged.minPrice);
  put("maxPrice", merged.maxPrice);
  put("minArea", merged.minArea);
  put("maxArea", merged.maxArea);
  if ((merged.minArea !== undefined || merged.maxArea !== undefined) && merged.unit && merged.unit !== "acre") put("unit", merged.unit);
  put("road", merged.road);
  put("water", merged.water);
  put("plantation", merged.plantation);
  if (merged.sort && merged.sort !== "newest") put("sort", merged.sort);
  if (merged.page && merged.page > 1) put("page", merged.page);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(f: SearchFilters): number {
  return [f.q, f.location, f.type, f.seller, f.minPrice, f.maxPrice, f.minArea, f.maxArea, f.plantation]
    .filter((v) => v !== undefined).length + (f.road ? 1 : 0) + (f.water ? 1 : 0);
}
