import { z } from "zod";
import { PROPERTY_ACTIONS } from "@/lib/domain/property-lifecycle";

// Shared validation for listing drafts (architecture §24, GAP-03 PROPOSED).
// Mirrors the database CHECK constraints; the database remains authoritative.
// Drafts accept partial data (autosave); completeness is enforced on submit
// by app.property_submission_gaps().

export const PROPERTY_TYPES = [
  "coffee_estate",
  "agricultural_land",
  "farm_land",
  "residential_plot",
  "commercial_land",
  "house_villa",
  "homestay_resort",
  "other",
] as const;
export const LISTING_TYPES = ["sale", "lease"] as const;
export const SELLER_TYPES = ["owner", "agent", "developer"] as const;
export const AREA_UNITS = ["sqft", "sqm", "cent", "guntha", "acre", "hectare"] as const;

// Money and area travel as decimal strings: no float drift (DB-004).
const positiveDecimal = (intDigits: number, fractionDigits: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,${intDigits}}(\\.\\d{1,${fractionDigits}})?$`), "Enter a number")
    .refine((v) => Number(v) > 0, "Must be greater than zero");

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v))
    .nullable();

/** Fields an owner may write. Anything else (status, owner, publication,
 *  featured, ids) is rejected rather than ignored (ROLE-004). */
export const propertyDraftSchema = z.strictObject({
  title: optionalText(120),
  description: optionalText(5000),
  property_type: z.enum(PROPERTY_TYPES).nullable(),
  listing_type: z.enum(LISTING_TYPES),
  seller_type: z.enum(SELLER_TYPES).nullable(),
  price: positiveDecimal(12, 2).nullable(),
  negotiable: z.boolean(),
  area_value: positiveDecimal(10, 4).nullable(),
  area_unit: z.enum(AREA_UNITS).nullable(),
  location_id: z.uuid().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  address_text: optionalText(300),
  road_access: z.boolean().nullable(),
  water_available: z.boolean().nullable(),
  electricity_available: z.boolean().nullable(),
});

/** PATCH semantics: omitted fields are left unchanged; null clears. */
export const propertyDraftPatchSchema = propertyDraftSchema.partial();
export type PropertyDraftPatch = z.infer<typeof propertyDraftPatchSchema>;

export const transitionSchema = z.strictObject({
  propertyId: z.uuid(),
  action: z.enum(PROPERTY_ACTIONS),
  expectedVersion: z.int().positive(),
  revisionId: z.uuid().nullable().optional(),
  reason: z.string().max(2000).optional(),
  internalNotes: z.string().max(4000).optional(),
  requestId: z.uuid().optional(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;
