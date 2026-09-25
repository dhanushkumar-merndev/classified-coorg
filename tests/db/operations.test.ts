// ENQ status, GAP-07 email sync, GAP-12 delivery queue, GAP-27 maintenance,
// CHART/DASH aggregates and their range caps.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { TestDb, service, user } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  await db.sql("update app.rate_limit_policies set max_hits = 100000 where action in ('property_create', 'upload_initiate', 'enquiry_create')");
  admin = await db.createUser({ roles: ["admin"] });
});

async function enquiry() {
  const owner = await db.createUser({ roles: ["seller"] });
  const id = await db.createCompleteDraft(owner);
  await db.publish(id, owner, admin);
  const buyer = await db.createUser();
  const [{ r }] = await db.rows<{ r: { enquiry_id: string } }>(user(buyer),
    "select public.create_enquiry($1, 'Hello', $2) as r", [id, randomUUID()]);
  return { owner, buyer, enquiryId: r.enquiry_id, propertyId: id };
}

describe("enquiry status (broker model)", () => {
  test("only the platform team moves new -> read -> closed; closed is final and audited", async () => {
    const { owner, buyer, enquiryId } = await enquiry();
    expect(await db.error(user(buyer), "select public.update_enquiry_status($1, 'read')", [enquiryId])).toBe("FORBIDDEN");
    expect(await db.error(user(owner), "select public.update_enquiry_status($1, 'read')", [enquiryId])).toBe("FORBIDDEN");
    expect(await db.error(user(admin), "select public.update_enquiry_status($1, 'new')", [enquiryId])).toBe("VALIDATION_FAILED");
    await db.rows(user(admin), "select public.update_enquiry_status($1, 'read')", [enquiryId]);
    await db.rows(user(admin), "select public.update_enquiry_status($1, 'closed')", [enquiryId]);
    const [{ r }] = await db.rows<{ r: { changed: boolean; status: string } }>(user(admin),
      "select public.update_enquiry_status($1, 'read') as r", [enquiryId]);
    expect(r).toMatchObject({ changed: false, status: "closed" });
    expect(await db.sql("select action from public.audit_logs where entity_type = 'enquiry' and entity_id = $1 order by id", [enquiryId]))
      .toEqual([{ action: "enquiry.read" }, { action: "enquiry.closed" }]);
  });
});

describe("verified email sync", () => {
  test("profiles.email holds only confirmed addresses", async () => {
    const id = await db.createUser();
    await db.sql("update auth.users set email = 'owner@example.test' where id = $1", [id]);
    expect(await db.sql("select email from public.profiles where id = $1", [id])).toEqual([{ email: null }]);
    await db.sql("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    expect(await db.sql("select email from public.profiles where id = $1", [id])).toEqual([{ email: "owner@example.test" }]);
  });
});

describe("notification delivery queue", () => {
  test("claims are leased, exclusive, and retried with backoff until abandoned", async () => {
    await db.sql("update public.notification_intents set status = 'sent'");
    const { propertyId } = await enquiry();
    const claim = () => db.rows<{ id: string; event_type: string; attempts: number }>(service,
      "select id, event_type, attempts from public.claim_notification_intents(50, 60)");

    const first = await claim();
    expect(first.map((c) => c.event_type).sort()).toEqual(
      // owner + buyer are new; the admin's welcome was marked sent above.
      ["listing_approved", "listing_submitted", "new_enquiry", "welcome", "welcome"].sort());
    expect(await claim()).toEqual([]); // leased

    const target = first.find((c) => c.event_type === "listing_approved")!;
    await db.rows(service, "select public.complete_notification_intent($1, 'failed', 'smtp timeout')", [target.id]);
    const [row] = await db.sql<{ status: string; due_in: number }>(
      "select status, extract(epoch from next_attempt_at - now())::int as due_in from public.notification_intents where id = $1",
      [target.id]);
    expect(row.status).toBe("failed");
    expect(row.due_in).toBeGreaterThan(0);

    await db.sql("update public.notification_intents set attempts = 5, status = 'processing' where id = $1", [target.id]);
    await db.rows(service, "select public.complete_notification_intent($1, 'failed', 'still failing')", [target.id]);
    expect(await db.sql("select status from public.notification_intents where id = $1", [target.id]))
      .toEqual([{ status: "cancelled" }]);
    expect(propertyId).toBeTruthy();
  });

  test("clients cannot touch the queue", async () => {
    const someone = await db.createUser();
    expect(await db.error(user(someone), "select public.claim_notification_intents(10, 60)")).toMatch(/permission denied/);
  });
});

describe("maintenance", () => {
  test("expires stale upload sessions and returns their quarantine objects", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const [{ id }] = await db.rows<{ id: string }>(user(owner), "insert into public.properties (title) values ('Maintenance test') returning id");
    const [{ r }] = await db.rows<{ r: { quarantine_key: string } }>(service,
      "select public.upload_session_create($1, $2, 'property_image', null, 10, 'image/jpeg', 'a', 'media', 20, 600) as r", [owner, id]);
    await db.sql("update app.upload_sessions set expires_at = now() - interval '1 minute' where quarantine_key = $1", [r.quarantine_key]);
    const [{ out }] = await db.rows<{ out: { expired_uploads: Array<{ key: string }> } }>(service,
      "select public.run_maintenance(100) as out");
    expect(out.expired_uploads.map((u) => u.key)).toContain(r.quarantine_key);
    const [{ again }] = await db.rows<{ again: { expired_uploads: unknown[] } }>(service, "select public.run_maintenance(100) as again");
    expect(again.expired_uploads).toEqual([]);
  });
});

describe("admin analytics", () => {
  test("summary and trend are admin-only aggregates", async () => {
    await enquiry();
    const [{ s }] = await db.rows<{ s: Record<string, unknown> }>(user(admin), "select public.admin_dashboard_summary() as s");
    expect(s).toHaveProperty("status_counts.verified");
    expect((s.funnel_90d as Record<string, number>).approved).toBeGreaterThan(0);

    const today = new Date().toISOString().slice(0, 10);
    const [{ t }] = await db.rows<{ t: Array<{ bucket: string; count: number }> }>(user(admin),
      "select public.admin_trend('enquiries', 'day', ($1::date - 6), $1::date) as t", [today]);
    expect(t).toHaveLength(7);
    expect(t.at(-1)!.count).toBeGreaterThan(0);

    const buyer = await db.createUser();
    expect(await db.error(user(buyer), "select public.admin_dashboard_summary()")).toBe("FORBIDDEN");
  });

  test("caller-controlled ranges are capped", async () => {
    expect(await db.error(user(admin), "select public.admin_trend('enquiries', 'day', '2020-01-01', '2026-01-01')"))
      .toBe("VALIDATION_FAILED");
    expect(await db.error(user(admin), "select public.admin_trend('enquiries', 'hour', '2026-01-01', '2026-01-02')"))
      .toBe("VALIDATION_FAILED");
  });
});

describe("owners never see buyers (broker model)", () => {
  test("the owner gets interest counts only; the buyer inbox is closed to them", async () => {
    const { owner, buyer, enquiryId } = await enquiry();
    expect(await db.error(user(owner), "select id from public.list_received_enquiries(null, 25, 0)")).toMatch(/permission denied/);
    expect(await db.rows(user(owner), "select buyer_id, message from public.enquiries where id = $1", [enquiryId])).toEqual([]);
    expect(await db.rows(user(owner), "select total, unread from public.seller_enquiry_counts()")).toEqual([{ total: 1, unread: 1 }]);
    expect(await db.rows(user(buyer), "select total from public.seller_enquiry_counts()")).toEqual([]);
    // The platform team sees the buyer and the message.
    expect(await db.rows(user(admin), "select buyer_id, message from public.enquiries where id = $1", [enquiryId]))
      .toEqual([{ buyer_id: buyer, message: "Hello" }]);
  });
});
