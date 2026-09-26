import { beforeAll, describe, expect, test } from "vitest";
import { AMENITY_OPTIONS, FEATURE_OPTIONS } from "../../src/lib/listing/details";
import { TestDb, user } from "./harness";

let db: TestDb;
let owner: string;
let id: string;
beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createUser({ roles: ["seller"] });
  id = await db.createCompleteDraft(owner);
});

async function setCounts(amenities: number, features: number) {
  await db.rows(user(owner), "delete from public.property_features where property_id = $1", [id]);
  await db.rows(user(owner), `update public.properties set road_access = $2, water_available = $3, electricity_available = $4 where id = $1`,
    [id, amenities > 0, amenities > 1, amenities > 2]);
  const entries = [...AMENITY_OPTIONS.slice(3, amenities), ...FEATURE_OPTIONS.slice(0, features)];
  for (const option of entries) await db.rows(user(owner),
    "insert into public.property_features (property_id, feature_key, feature_value) values ($1, $2, $3)",
    [id, option.key, option.kind === "text" ? "Coffee and valley views" : "true"]);
}
async function gaps() {
  return (await db.sql<{ gaps: string[] }>("select app.property_submission_gaps(p) as gaps from public.properties p where id = $1", [id]))[0]!.gaps;
}

describe("database detail count rules", () => {
  test("allows every supported amenities/features total", async () => {
    for (const amenities of [3, 6, 9]) for (const features of [6, 8, 10, 12]) {
      await setCounts(amenities, features);
      expect(await gaps(), `${amenities} amenities / ${features} features`).toEqual([]);
    }
  });
  test("partial drafts save but cannot be submitted through the RPC", async () => {
    await setCounts(4, 7);
    expect(await gaps()).toEqual(expect.arrayContaining(["amenities", "features"]));
    await expect(db.transition(user(owner), id, "submit")).rejects.toThrow("LISTING_INCOMPLETE");
    expect((await db.property(id)).status).toBe("draft");
  });
  test("unsupported keys and blank values do not fill the required count", async () => {
    await setCounts(3, 6);
    await db.rows(user(owner), "update public.property_features set feature_value = '   ' where property_id = $1 and feature_key = 'view'", [id]);
    await db.rows(user(owner), "insert into public.property_features (property_id, feature_key, feature_value) values ($1, 'distance_to_town_km', '2')", [id]);
    expect(await gaps()).toContain("features");
  });
  test("valid counts submit while retaining existing photo checks", async () => {
    await setCounts(6, 8);
    await db.transition(user(owner), id, "submit");
    expect((await db.property(id)).status).toBe("submitted");
  });
});
