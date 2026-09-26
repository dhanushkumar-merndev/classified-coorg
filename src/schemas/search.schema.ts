import { z } from "zod";
import { AREA_UNITS, PROPERTY_TYPES, SELLER_TYPES } from "@/schemas/property.schema";
import {
  MAX_PAGE,
  PAGE_SIZE,
  SORTS,
  activeFilterCount,
  toQueryString,
  type AreaUnit,
  type PropertyType,
  type SearchFilters,
  type SellerType,
  type SortKey,
} from "./search-params";

export {
  MAX_PAGE,
  PAGE_SIZE,
  SORTS,
  activeFilterCount,
  toQueryString,
  type AreaUnit,
  type PropertyType,
  type SearchFilters,
  type SellerType,
  type SortKey,
};

// Public search URL state (design §13–14, GAP-14). Every value is validated;
// anything malformed is dropped rather than failing the page, so shared or
// hand-edited URLs still render a sensible result.

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
  return parsed as SearchFilters;
}
