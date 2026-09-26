/** Seller entry counts. Drafts may be incomplete; submission uses exact totals. */
export const AMENITY_COUNTS = [3, 6, 9] as const;
export const FEATURE_COUNTS = [6, 8, 10, 12] as const;

export interface DetailOption {
  key: string;
  label: string;
  kind: "boolean" | "text";
}

export const CORE_AMENITY_KEYS = ["road_access", "water_available", "electricity_available"] as const;
export type CoreAmenities = Partial<Record<(typeof CORE_AMENITY_KEYS)[number], boolean | null>>;

export const AMENITY_OPTIONS: DetailOption[] = [
  { key: "road_access", label: "Road access", kind: "boolean" },
  { key: "water_available", label: "Water supply", kind: "boolean" },
  { key: "electricity_available", label: "Electricity", kind: "boolean" },
  { key: "borewell", label: "Borewell", kind: "boolean" },
  { key: "stream_or_river", label: "Stream / river access", kind: "boolean" },
  { key: "pond", label: "Pond / water tank", kind: "boolean" },
  { key: "farmhouse", label: "Farmhouse / bungalow", kind: "boolean" },
  { key: "labour_quarters", label: "Staff quarters", kind: "boolean" },
  { key: "power_backup", label: "Power backup", kind: "boolean" },
];

export const FEATURE_OPTIONS: DetailOption[] = [
  { key: "plantation_type", label: "Plantation type", kind: "text" },
  { key: "fenced", label: "Fenced boundary", kind: "boolean" },
  { key: "drying_yard", label: "Coffee drying yard", kind: "boolean" },
  { key: "view", label: "Landscape / view", kind: "text" },
  { key: "shade_trees", label: "Shade trees", kind: "boolean" },
  { key: "pepper_vines", label: "Pepper vines", kind: "boolean" },
  { key: "fruit_trees", label: "Fruit trees", kind: "boolean" },
  { key: "irrigation", label: "Irrigation system", kind: "boolean" },
  { key: "coffee_pulping_unit", label: "Coffee pulping unit", kind: "boolean" },
  { key: "storage_shed", label: "Storage shed", kind: "boolean" },
  { key: "vehicle_access", label: "Internal vehicle access", kind: "boolean" },
  { key: "level_land", label: "Level / gently sloping land", kind: "boolean" },
];

export function isCoreAmenity(key: string): key is (typeof CORE_AMENITY_KEYS)[number] {
  return (CORE_AMENITY_KEYS as readonly string[]).includes(key);
}

/** Extra amenities share the existing key/value table with features. */
export const STORED_DETAIL_OPTIONS = [...AMENITY_OPTIONS.filter((o) => !isCoreAmenity(o.key)), ...FEATURE_OPTIONS];
export type DetailValues = Record<string, string | null | undefined>;

export function detailValueIsSelected(option: DetailOption, value: string | null | undefined): boolean {
  return option.kind === "boolean" ? value === "true" : Boolean(value?.trim() && value.trim() !== "false");
}

export function selectedAmenities(core: CoreAmenities, values: DetailValues) {
  return AMENITY_OPTIONS.filter((o) => isCoreAmenity(o.key) ? core[o.key] === true : detailValueIsSelected(o, values[o.key]));
}

export function selectedFeatures(values: DetailValues) {
  return FEATURE_OPTIONS.filter((o) => detailValueIsSelected(o, values[o.key]));
}

export function listingDetailGaps(core: CoreAmenities, values: DetailValues): Array<"amenities" | "features"> {
  const gaps: Array<"amenities" | "features"> = [];
  if (!(AMENITY_COUNTS as readonly number[]).includes(selectedAmenities(core, values).length)) gaps.push("amenities");
  if (!(FEATURE_COUNTS as readonly number[]).includes(selectedFeatures(values).length)) gaps.push("features");
  return gaps;
}

export function detailValues(rows: ReadonlyArray<{ feature_key: string; feature_value: string | null }>): DetailValues {
  return Object.fromEntries(rows.map((f) => [f.feature_key, f.feature_value]));
}
