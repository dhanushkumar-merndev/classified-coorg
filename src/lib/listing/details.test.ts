import { describe, expect, test } from "vitest";
import { AMENITY_OPTIONS, FEATURE_OPTIONS, detailValues, listingDetailGaps, selectedAmenities, selectedFeatures } from "./details";

const core = { road_access: true, water_available: true, electricity_available: true };
const features = (count: number) => Object.fromEntries(FEATURE_OPTIONS.slice(0, count).map((o) => [o.key, o.kind === "text" ? "Coffee and hills" : "true"]));

describe("seller detail counts", () => {
  test.each([3, 6, 9])("accepts %i amenities", (count) => {
    const values = { ...features(6), ...Object.fromEntries(AMENITY_OPTIONS.slice(3, count).map((o) => [o.key, "true"])) };
    expect(selectedAmenities(core, values)).toHaveLength(count);
    expect(listingDetailGaps(core, values)).toEqual([]);
  });
  test.each([6, 8, 10, 12])("accepts %i features", (count) => {
    expect(listingDetailGaps(core, features(count))).toEqual([]);
  });
  test.each([0, 1, 2, 4, 5, 7, 8])("rejects %i amenities at submission", (count) => {
    const selected = AMENITY_OPTIONS.slice(0, count);
    const values = { ...features(6), ...Object.fromEntries(selected.map((o) => [o.key, "true"])) };
    const coreValues = { road_access: count > 0, water_available: count > 1, electricity_available: count > 2 };
    expect(listingDetailGaps(coreValues, values)).toContain("amenities");
  });
  test.each([0, 1, 4, 5, 7, 9, 11])("rejects %i features at submission", (count) => {
    expect(listingDetailGaps(core, features(count))).toContain("features");
  });
  test("ignores empty, false, unknown and private location entries", () => {
    const values = detailValues([
      { feature_key: "view", feature_value: "   " },
      { feature_key: "plantation_type", feature_value: null },
      { feature_key: "fenced", feature_value: "false" },
      { feature_key: "distance_to_town_km", feature_value: "0.2" },
      { feature_key: "exact_directions", feature_value: "private lane" },
      { feature_key: "borewell", feature_value: "yes" },
    ]);
    expect(selectedFeatures(values)).toEqual([]);
    expect(selectedAmenities({}, values)).toEqual([]);
  });
});
