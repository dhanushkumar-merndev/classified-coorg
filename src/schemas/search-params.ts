export const SORTS = ["newest", "price_asc", "price_desc", "area_asc", "area_desc"] as const;
export type SortKey = (typeof SORTS)[number];

export const PAGE_SIZE = 24;
/** Offset budget: 400 pages × 24 = 9,600 rows (continue.md §25). */
export const MAX_PAGE = 400;

export type PropertyType =
  | "coffee_estate"
  | "agricultural_land"
  | "farm_land"
  | "residential_plot"
  | "commercial_land"
  | "house_villa"
  | "homestay_resort"
  | "other";

export type SellerType = "owner" | "agent" | "developer";
export type AreaUnit = "sqft" | "sqm" | "cent" | "guntha" | "acre" | "hectare";

export interface SearchFilters {
  q?: string;
  location?: string;
  type?: PropertyType;
  seller?: SellerType;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  unit: AreaUnit;
  road: boolean;
  water: boolean;
  plantation?: string;
  sort: SortKey;
  page: number;
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
