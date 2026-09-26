import { beforeAll, describe, expect, test } from "vitest";
import { TestDb, anon, service, user } from "./harness";

let db: TestDb;
let owner: string;
let buyer: string;
let admin: string;
let id: string;
beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createUser({ roles: ["seller"] });
  buyer = await db.createUser();
  admin = await db.createUser({ roles: ["admin"] });
  id = await db.createCompleteDraft(owner);
  await db.rows(user(owner), "update public.properties set address_text = 'Private entrance address', latitude = 12.45, longitude = 75.74 where id = $1", [id]);
  await db.rows(user(owner), "insert into public.property_features (property_id, feature_key, feature_value) values ($1, 'distance_to_town_km', '0.25')", [id]);
  await db.publish(id, owner, admin);
});

describe("broker location privacy", () => {
  test("anonymous and signed-in buyers cannot select exact location", async () => {
    for (const actor of [anon, user(buyer)]) {
      expect(await db.rows(actor, "select id, location_id from public.properties where id = $1", [id])).toHaveLength(1);
      for (const column of ["address_text", "latitude", "longitude"]) {
        expect(await db.error(actor, `select ${column} from public.properties where id = $1`, [id])).toMatch(/permission denied/);
      }
    }
  });
  test("private location remains stored for authorized server-side reads", async () => {
    const row = await db.one(service, "select address_text, latitude, longitude from public.properties where id = $1 and owner_id = $2", [id, owner]);
    expect(row).toMatchObject({ address_text: "Private entrance address" });
    expect(Number(row.latitude)).toBe(12.45);
    expect(Number(row.longitude)).toBe(75.74);
  });
  test("private location features are hidden from buyers but available to the owner and team", async () => {
    for (const actor of [anon, user(buyer)]) {
      const rows = await db.rows<{ feature_key: string }>(actor, "select feature_key from public.property_features where property_id = $1", [id]);
      expect(rows.map((r) => r.feature_key)).not.toContain("distance_to_town_km");
      expect(rows.map((r) => r.feature_key)).toContain("fenced");
    }
    for (const actor of [user(owner), user(admin)]) {
      expect(await db.rows(actor, "select feature_key from public.property_features where property_id = $1 and feature_key = 'distance_to_town_km'", [id])).toHaveLength(1);
    }
  });
});
