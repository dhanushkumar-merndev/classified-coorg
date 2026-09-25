// LIFE-001/002/003/008, GAP-01/02/09/13, DB-005/006.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import {
  PROPERTY_ACTIONS,
  PROPERTY_STATUSES,
  findTransition,
  type PropertyStatus,
} from "@/lib/domain/property-lifecycle";
import { TestDb, anon, service, user } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  // Fixtures create many listings; the creation limit has its own test.
  await db.sql("update app.rate_limit_policies set max_hits = 100000 where action = 'property_create'");
  admin = await db.createUser({ roles: ["admin"] });
});

const REASON = "Please add clearer photos of the boundary.";

/** Path from draft to each status, as [actor, action] steps. */
const PATHS: Record<PropertyStatus, Array<["owner" | "admin", string]>> = {
  draft: [],
  submitted: [["owner", "submit"]],
  under_review: [["owner", "submit"], ["admin", "begin_review"]],
  changes_required: [["owner", "submit"], ["admin", "begin_review"], ["admin", "request_changes"]],
  rejected: [["owner", "submit"], ["admin", "begin_review"], ["admin", "reject"]],
  verified: [["owner", "submit"], ["admin", "begin_review"], ["admin", "approve"]],
  sold: [["owner", "submit"], ["admin", "begin_review"], ["admin", "approve"], ["owner", "mark_sold"]],
  archived: [["owner", "submit"], ["admin", "begin_review"], ["admin", "approve"], ["owner", "mark_sold"], ["owner", "archive"]],
};

async function listingIn(status: PropertyStatus) {
  const owner = await db.createUser({ roles: ["seller"] });
  const id = await db.createCompleteDraft(owner);
  for (const [who, action] of PATHS[status]) {
    await db.transition(user(who === "owner" ? owner : admin), id, action, { reason: REASON });
  }
  expect((await db.property(id)).status).toBe(status);
  return { id, owner };
}

describe("transition matrix: 8 states x 7 actions x 4 actors", () => {
  for (const from of PROPERTY_STATUSES) {
    test(`from ${from}`, async () => {
      const otherSeller = await db.createUser({ roles: ["seller"] });
      const buyer = await db.createUser();
      for (const action of PROPERTY_ACTIONS) {
        for (const actorKind of ["owner", "admin", "otherSeller", "buyer"] as const) {
          const { id, owner } = await listingIn(from);
          const actorId = { owner, admin, otherSeller, buyer }[actorKind];
          const rule =
            actorKind === "owner" || actorKind === "admin" ? findTransition(from, action, actorKind) : undefined;
          const before = await db.property(id);
          const label = `${from} --${action}--> as ${actorKind}`;

          let outcome: string;
          try {
            const result = await db.transition(user(actorId), id, action, { reason: REASON });
            outcome = `ok:${result.status}`;
          } catch (error) {
            outcome = `error:${(error as Error).message}`;
          }

          if (rule) {
            expect(outcome, label).toBe(`ok:${rule.to}`);
            expect((await db.property(id)).version, label).toBe(before.version + 1);
          } else {
            expect(outcome, label).toMatch(/^error:/);
            // Denials leave no partial change.
            expect(await db.property(id), label).toEqual(before);
          }
        }
      }
    });
  }
});

describe("review integrity", () => {
  test("happy path publishes, writes history, review, audit and notification intents", async () => {
    const { id, owner } = await listingIn("draft");
    expect(await db.rows(anon, "select id from public.properties where id = $1", [id])).toEqual([]);

    await db.publish(id, owner, admin);

    expect(await db.rows(anon, "select id from public.properties where id = $1", [id])).toEqual([{ id }]);
    const history = await db.sql<{ action: string }>(
      "select action from public.property_status_history where property_id = $1 order by id", [id]);
    expect(history.map((h) => h.action)).toEqual(["submit", "begin_review", "approve"]);
    expect(await db.sql("select decision from public.verification_reviews where property_id = $1", [id]))
      .toEqual([{ decision: "approved" }]);
    const audit = await db.sql<{ action: string }>(
      "select action from public.audit_logs where entity_id = $1 order by id", [id]);
    expect(audit.map((a) => a.action)).toEqual(["property.begin_review", "property.approve"]);
    const intents = await db.sql<{ event_type: string }>(
      "select event_type from public.notification_intents where entity_id = $1 order by created_at", [id]);
    expect(intents.map((i) => i.event_type).sort()).toEqual(["listing_approved", "listing_submitted"]);
  });

  test("content is locked while submitted, even for the service role (GAP-01)", async () => {
    const { id, owner } = await listingIn("submitted");
    const updated = await db.rows(user(owner),
      "update public.properties set title = 'Changed title after submit' where id = $1 returning id", [id]);
    expect(updated).toEqual([]);
    expect(await db.error(service, "update public.properties set price = 1 where id = $1", [id]))
      .toBe("PROPERTY_NOT_EDITABLE");
    expect(await db.error(service,
      "insert into public.property_features (property_id, feature_key) values ($1, 'borewell')", [id]))
      .toBe("PROPERTY_NOT_EDITABLE");
  });

  test("stale version is a conflict, not an overwrite (GAP-09)", async () => {
    const { id, owner } = await listingIn("draft");
    const { version } = await db.property(id);
    await db.rows(user(owner), "update public.properties set price = 26000000 where id = $1", [id]);
    await expect(db.transition(user(owner), id, "submit", { version })).rejects.toThrow("VERSION_CONFLICT");
  });

  test("reviewers must act on the exact current revision", async () => {
    const { id } = await listingIn("submitted");
    await expect(db.transition(user(admin), id, "begin_review", { revisionId: randomUUID() }))
      .rejects.toThrow("REVISION_MISMATCH");
    await expect(db.transition(user(admin), id, "begin_review", { revisionId: null }))
      .rejects.toThrow("REVISION_MISMATCH");
  });

  test("an admin cannot review their own listing", async () => {
    const adminSeller = await db.createUser({ roles: ["admin", "seller"] });
    const id = await db.createCompleteDraft(adminSeller);
    await db.transition(user(adminSeller), id, "submit");
    await expect(db.transition(user(adminSeller), id, "begin_review")).rejects.toThrow("SELF_REVIEW_FORBIDDEN");
  });

  test("request_changes and reject require a reason", async () => {
    const { id } = await listingIn("under_review");
    await expect(db.transition(user(admin), id, "reject", { reason: "  " })).rejects.toThrow("REASON_REQUIRED");
  });

  test("a retried request id replays instead of transitioning twice", async () => {
    const { id, owner } = await listingIn("draft");
    const requestId = randomUUID();
    const { version } = await db.property(id);
    const first = await db.transition(user(owner), id, "submit", { requestId, version });
    const second = await db.transition(user(owner), id, "submit", { requestId, version });
    expect(first.replayed).toBe(false);
    expect(second).toMatchObject({ status: "submitted", replayed: true });
    expect(await db.sql("select count(*)::int as n from public.property_revisions where property_id = $1", [id]))
      .toEqual([{ n: 1 }]);
  });

  test("submission requires complete content, finalized uploads and a verified phone", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const [{ id }] = await db.rows<{ id: string }>(user(owner),
      "insert into public.properties (title) values ('Plot') returning id");
    const message = await db.transition(user(owner), id, "submit").catch((e: Error) => e);
    expect(message).toBeInstanceOf(Error);
    expect((message as Error).message).toBe("LISTING_INCOMPLETE");

    const unverified = await db.createUser({ roles: ["seller"], phoneConfirmed: false });
    const draft = await db.createCompleteDraft(unverified);
    await expect(db.transition(user(unverified), draft, "submit")).rejects.toThrow("PHONE_NOT_VERIFIED");
  });

  test("resubmission creates a new immutable revision snapshot", async () => {
    const { id, owner } = await listingIn("changes_required");
    await db.rows(user(owner), "update public.properties set price = 24000000 where id = $1", [id]);
    await db.transition(user(owner), id, "submit");
    const revisions = await db.sql<{ revision_no: number; price: string; media: number; docs: number }>(
      `select revision_no, snapshot->'property'->>'price' as price,
              jsonb_array_length(snapshot->'media') as media, jsonb_array_length(snapshot->'documents') as docs
       from public.property_revisions where property_id = $1 order by revision_no`, [id]);
    expect(revisions).toEqual([
      { revision_no: 1, price: "25000000.00", media: 4, docs: 1 },
      { revision_no: 2, price: "24000000.00", media: 4, docs: 1 },
    ]);
    await expect(db.sql("update public.property_revisions set snapshot = '{}' where property_id = $1", [id]))
      .rejects.toThrow("IMMUTABLE_RECORD");
  });

  test("status and publication fields cannot contradict each other", async () => {
    const { id } = await listingIn("draft");
    await expect(db.sql("update public.properties set status = 'verified' where id = $1", [id]))
      .rejects.toThrow(/check constraint/);
    await expect(db.sql("update public.properties set published_at = now() where id = $1", [id]))
      .rejects.toThrow(/check constraint/);
  });

  test("owners can soft-delete drafts only", async () => {
    const { id, owner } = await listingIn("draft");
    const { version } = await db.property(id);
    await db.rows(user(owner), "select public.delete_property_draft($1, $2)", [id, version]);
    expect(await db.rows(user(owner), "select id from public.properties where id = $1 and deleted_at is null", [id]))
      .toEqual([]);

    const submitted = await listingIn("submitted");
    const v2 = (await db.property(submitted.id)).version;
    expect(await db.error(user(submitted.owner), "select public.delete_property_draft($1, $2)", [submitted.id, v2]))
      .toBe("INVALID_STATUS_TRANSITION");
  });
});

describe("single public eligibility predicate (GAP-02)", () => {
  async function anonCanSee(id: string) {
    const rows = await db.rows(anon, "select id from public.properties where id = $1", [id]);
    return rows.length === 1;
  }

  test("seller suspension hides and reactivation restores listings", async () => {
    const { id, owner } = await listingIn("verified");
    const superAdmin = await db.createUser({ roles: ["super_admin"] });
    expect(await anonCanSee(id)).toBe(true);
    await db.rows(user(superAdmin), "select public.admin_set_suspension($1, true, 'Fraud report under review')", [owner]);
    expect(await anonCanSee(id)).toBe(false);
    await db.rows(user(superAdmin), "select public.admin_set_suspension($1, false, 'Cleared after review')", [owner]);
    expect(await anonCanSee(id)).toBe(true);
  });

  test("inactive location, expiry, future publication and sold status hide listings", async () => {
    const a = await listingIn("verified");
    const locationId = await db.locationId();
    await db.sql("update public.locations set is_active = false where id = $1", [locationId]);
    expect(await anonCanSee(a.id)).toBe(false);
    await db.sql("update public.locations set is_active = true where id = $1", [locationId]);
    expect(await anonCanSee(a.id)).toBe(true);

    await db.sql("update public.properties set expires_at = now() where id = $1", [a.id]);
    expect(await anonCanSee(a.id)).toBe(false);

    const b = await listingIn("verified");
    await db.sql("update public.properties set published_at = now() + interval '1 day' where id = $1", [b.id]);
    expect(await anonCanSee(b.id)).toBe(false);

    const c = await listingIn("sold");
    expect(await anonCanSee(c.id)).toBe(false);
  });

  test("children of hidden listings are hidden; drafts' media never public", async () => {
    const { id, owner } = await listingIn("draft");
    expect(await db.rows(anon, "select id from public.property_media where property_id = $1", [id])).toEqual([]);
    expect(await db.rows(user(owner), "select id from public.property_media where property_id = $1", [id]))
      .toHaveLength(4);
    await db.publish(id, owner, admin);
    expect(await db.rows(anon, "select id from public.property_media where property_id = $1", [id])).toHaveLength(4);
  });

  test("public reads show the seller type only: no name, contact details or exact location (broker model)", async () => {
    const { id } = await listingIn("verified");
    expect(await db.rows(anon, "select title, seller_type from public.properties where id = $1", [id])).toHaveLength(1);
    for (const column of ["owner_id", "address_text", "latitude", "longitude"]) {
      expect(await db.error(anon, `select ${column} from public.properties where id = $1`, [id])).toMatch(/permission denied/);
    }
    expect(await db.error(anon, "select public.get_listing_seller($1)", [id])).toMatch(/permission denied/);
  });
});

describe("contact details in listing text (broker model)", () => {
  test("phone numbers and emails in the title or description block submission", async () => {
    const [{ yes }] = await db.sql<{ yes: boolean[] }>(`select array[
      app.text_has_contact_details('Call 98765 43210 for a visit'),
      app.text_has_contact_details('whatsapp +91-98765-43210'),
      app.text_has_contact_details('ring 09876543210'),
      app.text_has_contact_details('mail owner@example.com'),
      app.text_has_contact_details('5 acres at 3,200 ft, price 2.5 Cr, 1200 coffee plants, since 1985')
    ] as yes`);
    expect(yes).toEqual([true, true, true, true, false]);
  });
});

describe("listing photo rules", () => {
  test("submission needs 4 photos including a portrait and a landscape", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const id = await db.createCompleteDraft(owner);
    const gaps = async () => (await db.sql<{ g: string[] }>(
      "select app.property_submission_gaps(p) as g from public.properties p where p.id = $1", [id]))[0]!.g;
    expect(await gaps()).toEqual([]);

    // Remove the only portrait → portrait gap and too few photos.
    await db.sql("update public.property_media set removed_at = now() where property_id = $1 and height > width", [id]);
    expect(await gaps()).toEqual(expect.arrayContaining(["photos", "photo_portrait"]));
    expect(await gaps()).not.toContain("photo_landscape");

    // Four square photos: enough photos, but neither orientation.
    const squareOnly = await db.createCompleteDraft(owner);
    await db.sql("update public.property_media set width = 1000, height = 1000 where property_id = $1", [squareOnly]);
    const [{ g }] = await db.sql<{ g: string[] }>("select app.property_submission_gaps(p) as g from public.properties p where p.id = $1", [squareOnly]);
    expect(g).toEqual(expect.arrayContaining(["photo_portrait", "photo_landscape"]));
    expect(g).not.toContain("photos");
  });
});
