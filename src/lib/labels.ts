import type { PropertyStatus } from "@/lib/domain/property-lifecycle";

// Human-readable labels for stored enumeration values, plus URL slugs for
// public filters (design §13 example: ?type=coffee-estate).

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  coffee_estate: "Coffee estate",
  agricultural_land: "Agricultural land",
  farm_land: "Farm land",
  residential_plot: "Residential plot",
  commercial_land: "Commercial land",
  house_villa: "House / villa",
  homestay_resort: "Homestay / resort",
  other: "Other property",
};

export const PROPERTY_TYPE_BLURBS: Record<string, string> = {
  coffee_estate: "Working Arabica and Robusta plantations.",
  agricultural_land: "Land for paddy, areca, cardamom or mixed crops.",
  farm_land: "Smaller holdings for a farmhouse or orchard.",
  residential_plot: "Plots in and around towns, ready to build.",
  commercial_land: "Road-facing land for shops or hospitality.",
  house_villa: "Independent homes and estate bungalows.",
  homestay_resort: "Running homestays and resorts.",
  other: "Everything else, from forest-edge to mixed-use.",
};

export const SELLER_TYPE_LABELS: Record<string, string> = {
  owner: "Owner",
  agent: "Agent",
  developer: "Developer",
};

export const LISTING_TYPE_LABELS: Record<string, string> = { sale: "For sale", lease: "For lease" };

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  title_deed: "Title deed / sale deed",
  rtc: "RTC (Pahani)",
  encumbrance_certificate: "Encumbrance certificate",
  khata: "Khata",
  tax_receipt: "Tax receipt",
  survey_sketch: "Survey sketch",
  conversion_order: "Land conversion order",
  other: "Other document",
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_required: "Changes required",
  rejected: "Rejected",
  verified: "Verified",
  sold: "Sold",
  archived: "Archived",
};

/** Status chip tone, mapped to design.md status colours. */
export const STATUS_TONE: Record<PropertyStatus, "draft" | "warning" | "info" | "success" | "destructive"> = {
  draft: "draft",
  submitted: "info",
  under_review: "warning",
  changes_required: "warning",
  rejected: "destructive",
  verified: "success",
  sold: "info",
  archived: "draft",
};

export const ENQUIRY_STATUS_LABELS: Record<string, string> = { new: "New", read: "In progress", closed: "Closed" };

/** app.property_submission_gaps() keys (GAP-03), for the submit checklist. */
export const SUBMISSION_GAP_LABELS: Record<string, string> = {
  title: "Title (at least 10 characters)",
  description: "Description (at least 50 characters)",
  contact_details: "Remove phone numbers and email addresses from the title and description",
  property_type: "Property type",
  seller_type: "Seller type",
  price: "Price",
  area: "Area and unit",
  location: "Location",
  photos: "At least 4 photos",
  photo_portrait: "At least one portrait photo (3:4 or 9:16)",
  photo_landscape: "At least one landscape photo (4:3 or 16:9)",
  cover_photo: "A cover photo",
  documents: "At least one document",
  uploads_in_progress: "Wait for uploads in progress to finish",
};

export const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  agent: "Agent",
  admin: "Admin",
  super_admin: "Super admin",
};

/** Feature keys offered in the listing form (PROPOSED, GAP-03). */
export const FEATURE_OPTIONS: Array<{ key: string; label: string; kind: "boolean" | "text" }> = [
  { key: "plantation_type", label: "Plantation (e.g. Arabica, Robusta, pepper)", kind: "text" },
  { key: "borewell", label: "Borewell", kind: "boolean" },
  { key: "stream_or_river", label: "Stream or river frontage", kind: "boolean" },
  { key: "pond", label: "Pond / tank", kind: "boolean" },
  { key: "fenced", label: "Fenced boundary", kind: "boolean" },
  { key: "farmhouse", label: "Farmhouse / bungalow", kind: "boolean" },
  { key: "labour_quarters", label: "Labour quarters", kind: "boolean" },
  { key: "drying_yard", label: "Coffee drying yard", kind: "boolean" },
  { key: "view", label: "View (valley, hill, forest)", kind: "text" },
  { key: "distance_to_town_km", label: "Distance to nearest town (km)", kind: "text" },
];

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(FEATURE_OPTIONS.map((f) => [f.key, f.label.replace(/ \(.*\)$/, "")]));

export function toSlug(value: string): string {
  return value.replace(/_/g, "-");
}

export function fromSlug(value: string): string {
  return value.replace(/-/g, "_");
}

export const VERIFIED_DISCLAIMER =
  "Listing information reviewed by the platform. Buyers should complete independent legal verification before purchase.";
