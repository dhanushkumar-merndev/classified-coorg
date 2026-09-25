// RLS-002..006/008, ROLE-001/003/004/006, ENQ, SAVE, DOC-002/006, MEDIA-002/009, STOR-004.
// Every assertion uses a real anon/authenticated role, never the service role,
// for actor denials (test.md §4.2).
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { TestDb, anon, service, user } from "./harness";

let db: TestDb;
let admin: string;
let superAdmin: string;

beforeAll(async () => {
  db = await TestDb.create();
  await db.sql("update app.rate_limit_policies set max_hits = 100000 where action in ('property_create', 'upload_initiate')");
  admin = await db.createUser({ roles: ["admin"] });
  superAdmin = await db.createUser({ roles: ["super_admin"] });
});

const DENIED = /permission denied|row-level security/;

async function publishedListing() {
  const owner = await db.createUser({ roles: ["seller"] });
  const id = await db.createCompleteDraft(owner);
  await db.publish(id, owner, admin);
  return { id, owner };
}

describe("identity and roles", () => {
  test("users read and edit only their own safe profile fields", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    expect(await db.rows(user(a), "select id from public.profiles where id = $1", [b])).toEqual([]);
    expect(await db.rows(user(a), "update public.profiles set full_name = 'X' where id = $1 returning id", [b])).toEqual([]);
    expect(await db.rows(user(a), "update public.profiles set full_name = 'Asha K' where id = $1 returning full_name", [a]))
      .toEqual([{ full_name: "Asha K" }]);
    for (const column of ["is_suspended = false", "phone = '+919999999999'", "user_type = 'agent'"]) {
      expect(await db.error(user(a), `update public.profiles set ${column} where id = $1`, [a])).toMatch(DENIED);
    }
    expect(await db.error(anon, "select id from public.profiles")).toMatch(DENIED);
  });

  test("nobody can grant themselves a role directly", async () => {
    const a = await db.createUser();
    expect(await db.error(user(a), "insert into public.user_roles (user_id, role_id) values ($1, 4)", [a]))
      .toMatch(DENIED);
    expect(await db.error(user(admin), "insert into public.user_roles (user_id, role_id) values ($1, 5)", [admin]))
      .toMatch(DENIED);
  });

  test("seller onboarding adds only the seller capability, with preconditions", async () => {
    const a = await db.createUser();
    await db.rows(user(a), "select public.become_seller('owner')");
    const roles = await db.sql<{ name: string }>(
      "select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1 order by 1", [a]);
    expect(roles.map((r) => r.name)).toEqual(["buyer", "seller"]);
    expect(await db.error(user(a), "select public.become_seller('agent')")).toBe("VALIDATION_FAILED");
    const unverified = await db.createUser({ phoneConfirmed: false });
    expect(await db.error(user(unverified), "select public.become_seller('owner')")).toBe("PHONE_NOT_VERIFIED");
  });

  test("admin versus super-admin boundaries (GAP-05)", async () => {
    const buyer = await db.createUser();
    const otherAdmin = await db.createUser({ roles: ["admin"] });
    const reason = "Verified agency paperwork";

    await db.rows(user(admin), "select public.admin_change_role($1, 'agent', true, $2)", [buyer, reason]);
    expect(await db.error(user(admin), "select public.admin_change_role($1, 'admin', true, $2)", [buyer, reason]))
      .toBe("FORBIDDEN");
    expect(await db.error(user(admin), "select public.admin_change_role($1, 'admin', false, $2)", [otherAdmin, reason]))
      .toBe("FORBIDDEN");
    expect(await db.error(user(admin), "select public.admin_set_suspension($1, true, $2)", [otherAdmin, reason]))
      .toBe("FORBIDDEN");
    expect(await db.error(user(admin), "select public.admin_set_suspension($1, true, $2)", [admin, reason]))
      .toBe("SELF_ACTION_FORBIDDEN");
    expect(await db.error(user(buyer), "select public.admin_change_role($1, 'seller', true, $2)", [buyer, reason]))
      .toBe("FORBIDDEN");

    await db.rows(user(superAdmin), "select public.admin_change_role($1, 'admin', true, $2)", [buyer, reason]);
    expect(await db.error(user(superAdmin), "select public.admin_change_role($1, 'super_admin', false, $2)", [superAdmin, reason]))
      .toBe("SELF_ROLE_CHANGE_FORBIDDEN");

    const audit = await db.sql<{ action: string }>(
      "select action from public.audit_logs where entity_id = $1 order by id", [buyer]);
    expect(audit.map((a) => a.action)).toEqual(["role.grant", "role.grant"]);
  });

  test("suspension applies to already-issued sessions (RLS-008)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const id = await db.createCompleteDraft(owner);
    await db.rows(user(admin), "select public.admin_set_suspension($1, true, 'Suspicious activity')", [owner]);
    expect(await db.rows(user(owner), "update public.properties set price = 1 where id = $1 returning id", [id]))
      .toEqual([]);
    await expect(db.transition(user(owner), id, "submit")).rejects.toThrow("ACCOUNT_SUSPENDED");
    expect(await db.error(user(owner), "insert into public.properties (title) values ('New listing attempt')"))
      .toMatch(DENIED);
  });

  test("buyers cannot create listings", async () => {
    const buyer = await db.createUser();
    expect(await db.error(user(buyer), "insert into public.properties (title) values ('Not a seller listing')"))
      .toMatch(DENIED);
  });

  test("privileged listing columns are not client-writable (ROLE-004)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const id = await db.createCompleteDraft(owner);
    for (const column of ["status = 'verified'", "featured = true", "published_at = now()", "owner_id = gen_random_uuid()", "deleted_at = null"]) {
      expect(await db.error(user(owner), `update public.properties set ${column} where id = $1`, [id])).toMatch(DENIED);
    }
  });
});

describe("private documents and review data", () => {
  test("only the owner and admins can see document rows (DOC-002)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const otherSeller = await db.createUser({ roles: ["seller"] });
    const buyer = await db.createUser();
    const id = await db.createCompleteDraft(owner);
    await db.publish(id, owner, admin);

    const q = "select id from public.property_documents where property_id = $1";
    expect(await db.error(anon, q, [id])).toMatch(DENIED);
    expect(await db.rows(user(buyer), q, [id])).toEqual([]);
    expect(await db.rows(user(otherSeller), q, [id])).toEqual([]);
    expect(await db.rows(user(owner), q, [id])).toHaveLength(1);
    expect(await db.rows(user(admin), q, [id])).toHaveLength(1);
  });

  test("owners see review feedback but not internal notes (DOC-006)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const id = await db.createCompleteDraft(owner);
    await db.transition(user(owner), id, "submit");
    await db.transition(user(admin), id, "begin_review");
    const { version, current_revision_id } = await db.property(id);
    await db.rows(user(admin), "select public.transition_property($1, 'request_changes', $2, $3, $4, $5)",
      [id, version, current_revision_id, "Upload a clearer RTC copy.", "Possible boundary dispute with neighbour."]);

    expect(await db.rows(user(owner), "select owner_message from public.verification_reviews where property_id = $1", [id]))
      .toEqual([{ owner_message: "Upload a clearer RTC copy." }]);
    expect(await db.error(user(owner), "select internal_notes from public.verification_reviews where property_id = $1", [id]))
      .toMatch(DENIED);
    expect(await db.error(user(owner), "select * from public.verification_reviews")).toMatch(DENIED);
  });

  test("audit logs, admin notes and delivery intents are server-only", async () => {
    for (const table of ["audit_logs", "admin_notes", "notification_intents"]) {
      expect(await db.error(user(superAdmin), `select 1 from public.${table}`)).toMatch(DENIED);
    }
    expect(await db.error(service, "delete from public.audit_logs")).toMatch(/permission denied|IMMUTABLE_RECORD/);
  });

  test("internal stores and server-only RPCs are unreachable with a user token", async () => {
    const someone = await db.createUser({ roles: ["seller"] });
    expect(await db.error(user(someone), "select * from app.rate_limits")).toMatch(DENIED);
    expect(await db.error(user(someone), "select * from app.upload_sessions")).toMatch(DENIED);
    expect(await db.error(user(someone), "select public.consume_rate_limit('otp_request_ip', 'x')")).toMatch(DENIED);
    expect(await db.error(user(someone),
      "select public.upload_session_create($1, gen_random_uuid(), 'property_image', null, 1, 'image/jpeg', 'a', 'b', 20, 600)",
      [someone])).toMatch(DENIED);
  });
});

describe("buyer interactions", () => {
  test("favorites: own only, public listings only, identity not forgeable", async () => {
    const { id } = await publishedListing();
    const draftOwner = await db.createUser({ roles: ["seller"] });
    const draft = await db.createCompleteDraft(draftOwner);
    const a = await db.createUser();
    const b = await db.createUser();

    await db.rows(user(a), "insert into public.favorites (property_id) values ($1)", [id]);
    expect(await db.error(user(a), "insert into public.favorites (property_id) values ($1)", [draft])).toMatch(DENIED);
    expect(await db.error(user(a), "insert into public.favorites (user_id, property_id) values ($1, $2)", [b, id]))
      .toMatch(DENIED);
    expect(await db.rows(user(b), "select property_id from public.favorites")).toEqual([]);
    expect(await db.rows(user(b), "delete from public.favorites where user_id = $1 returning 1", [a])).toEqual([]);
  });

  test("enquiries: derived parties, idempotent, no self-contact, buyer and platform only (broker model)", async () => {
    const { id, owner } = await publishedListing();
    const buyer = await db.createUser();
    const stranger = await db.createUser();
    const key = randomUUID();

    const [{ r: first }] = await db.rows<{ r: { enquiry_id: string; replayed: boolean } }>(
      user(buyer), "select public.create_enquiry($1, 'Is the road motorable in monsoon?', $2) as r", [id, key]);
    const [{ r: again }] = await db.rows<{ r: { enquiry_id: string; replayed: boolean } }>(
      user(buyer), "select public.create_enquiry($1, 'Is the road motorable in monsoon?', $2) as r", [id, key]);
    expect(again).toEqual({ enquiry_id: first.enquiry_id, replayed: true });

    expect(await db.rows(user(buyer), "select id from public.enquiries where id = $1", [first.enquiry_id]))
      .toEqual([{ id: first.enquiry_id }]);
    // The owner never learns who enquired: the platform brokers the deal.
    expect(await db.rows(user(owner), "select buyer_id from public.enquiries where id = $1", [first.enquiry_id])).toEqual([]);
    expect(await db.rows(user(stranger), "select id from public.enquiries where id = $1", [first.enquiry_id])).toEqual([]);
    expect(await db.error(user(owner), "select public.create_enquiry($1, null, $2)", [id, randomUUID()]))
      .toBe("SELF_ENQUIRY_FORBIDDEN");
    expect(await db.error(user(buyer),
      "insert into public.enquiries (property_id, buyer_id, seller_id, idempotency_key) values ($1, $2, $3, $4)",
      [id, buyer, owner, randomUUID()])).toMatch(DENIED);

    const draftOwner = await db.createUser({ roles: ["seller"] });
    const draft = await db.createCompleteDraft(draftOwner);
    expect(await db.error(user(buyer), "select public.create_enquiry($1, null, $2)", [draft, randomUUID()]))
      .toBe("PROPERTY_NOT_AVAILABLE");
    // Notified: every active admin, never the owner.
    const [counts] = await db.sql<{ total: number; to_owner: number; non_admin: number }>(
      `select count(*)::int as total,
              count(*) filter (where n.recipient_id = $2)::int as to_owner,
              count(*) filter (where not exists (
                select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                where ur.user_id = n.recipient_id and r.name in ('admin', 'super_admin')))::int as non_admin
       from public.notification_intents n where n.event_type = 'new_enquiry' and n.entity_id = $1`,
      [first.enquiry_id, owner]);
    expect(counts!.total).toBeGreaterThan(0);
    expect(counts).toMatchObject({ to_owner: 0, non_admin: 0 });
  });

  test("enquiry creation is rate limited per buyer", async () => {
    const { id } = await publishedListing();
    const buyer = await db.createUser();
    const codes: string[] = [];
    for (let i = 0; i < 11; i++) {
      codes.push(await db.rows(user(buyer), "select public.create_enquiry($1, null, $2)", [id, randomUUID()])
        .then(() => "ok", (e: Error) => e.message));
    }
    expect(codes.filter((c) => c === "ok")).toHaveLength(10);
    expect(codes[10]).toBe("RATE_LIMITED");
  });

  test("recently viewed records only visible listings, for the caller", async () => {
    const { id } = await publishedListing();
    const draftOwner = await db.createUser({ roles: ["seller"] });
    const draft = await db.createCompleteDraft(draftOwner);
    const a = await db.createUser();
    expect(await db.rows(user(a), "select public.record_property_view($1) as ok", [id])).toEqual([{ ok: true }]);
    expect(await db.rows(user(a), "select public.record_property_view($1) as ok", [draft])).toEqual([{ ok: false }]);
    expect(await db.rows(user(a), "select property_id from public.recently_viewed")).toEqual([{ property_id: id }]);
  });
});

describe("upload sessions", () => {
  const create = (actor: string, property: string, max = 20) =>
    db.rows<{ r: { session_id: string } }>(service,
      "select public.upload_session_create($1, $2, 'property_image', null, 1000, 'image/jpeg', 'a.jpg', 'media', $3, 600) as r",
      [actor, property, max]).then((rows) => rows[0].r.session_id);
  const claim = (session: string, actor: string) =>
    db.rows<{ r: { lease_token: string; state: string } }>(service,
      "select public.upload_session_claim($1, $2, 120) as r", [session, actor]).then((rows) => rows[0].r);
  const finalize = (session: string, actor: string, token: string, max = 20) => {
    const mediaId = randomUUID();
    return db.rows<{ r: { id: string; replayed: boolean } }>(service,
      `select public.upload_session_finalize_media($1, $2, $3, $4, 'media', $5, $6, $7, 10, 10, 10, $8) as r`,
      [session, actor, token, mediaId, `properties/x/${mediaId}/full.webp`, `properties/x/${mediaId}/thumb.webp`,
        "b".repeat(64), max]).then((rows) => rows[0].r);
  };

  test("in-flight sessions count toward the per-listing limit (MEDIA-002)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const [{ id }] = await db.rows<{ id: string }>(user(owner),
      "insert into public.properties (title) values ('Quota listing test') returning id");
    await create(owner, id, 2);
    await create(owner, id, 2);
    await expect(create(owner, id, 2)).rejects.toThrow("UPLOAD_LIMIT_REACHED");
  });

  test("leases prevent double processing and finalize is idempotent (MEDIA-009)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const [{ id }] = await db.rows<{ id: string }>(user(owner),
      "insert into public.properties (title) values ('Lease listing test') returning id");
    const session = await create(owner, id);
    const lease = await claim(session, owner);
    await expect(claim(session, owner)).rejects.toThrow("UPLOAD_IN_PROGRESS");
    await expect(finalize(session, owner, randomUUID())).rejects.toThrow("UPLOAD_LEASE_LOST");

    const first = await finalize(session, owner, lease.lease_token);
    const second = await finalize(session, owner, lease.lease_token);
    expect(second).toEqual({ id: first.id, replayed: true });
    expect(await db.sql("select is_cover from public.property_media where property_id = $1", [id]))
      .toEqual([{ is_cover: true }]);
  });

  test("sessions are scoped to the owner and to editable listings", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const other = await db.createUser({ roles: ["seller"] });
    const id = await db.createCompleteDraft(owner);
    await expect(create(other, id)).rejects.toThrow("PROPERTY_NOT_FOUND");

    const session = await create(owner, id);
    // Submission waits for in-flight uploads.
    await expect(db.transition(user(owner), id, "submit")).rejects.toThrow("LISTING_INCOMPLETE");
    const lease = await claim(session, owner);
    await finalize(session, owner, lease.lease_token);
    await db.transition(user(owner), id, "submit");
    // A replayed/late upload cannot attach to a submitted listing.
    await expect(create(owner, id)).rejects.toThrow("PROPERTY_NOT_EDITABLE");
  });

  test("quarantine keys can never become final media paths (STOR-004)", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const [{ id }] = await db.rows<{ id: string }>(user(owner),
      "insert into public.properties (title) values ('Quarantine path test') returning id");
    await expect(db.sql(
      `insert into public.property_media (property_id, storage_bucket, storage_path, thumbnail_path, content_checksum, width, height, byte_size, uploaded_by)
       values ($1, 'media', 'quarantine/abc', 'properties/t.webp', $2, 1, 1, 1, $3)`, [id, "c".repeat(64), owner]))
      .rejects.toThrow(/check constraint/);
  });

  test("arranging media accepts exactly the listing's own photos", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const id = await db.createCompleteDraft(owner);
    const extra = await db.finalizeUpload(owner, id, "property_image");
    const others = (await db.sql<{ id: string }>(
      "select id from public.property_media where property_id = $1 and id <> $2 order by sort_order", [id, extra])).map((r) => r.id);
    const order = [extra, ...others];
    expect(await db.error(user(owner), "select public.arrange_property_media($1, $2, $3)",
      [id, [extra, randomUUID()], extra])).toBe("VALIDATION_FAILED");
    await db.rows(user(owner), "select public.arrange_property_media($1, $2, $3)", [id, order, extra]);
    expect(await db.sql("select id, sort_order, is_cover from public.property_media where property_id = $1 order by sort_order", [id]))
      .toEqual(order.map((m, i) => ({ id: m, sort_order: i, is_cover: i === 0 })));
    const stranger = await db.createUser({ roles: ["seller"] });
    expect(await db.error(user(stranger), "select public.arrange_property_media($1, $2, $3)",
      [id, order, extra])).toBe("PROPERTY_NOT_FOUND");
  });
});

describe("rate limiter", () => {
  test("login codes: 2 per minute per browser fingerprint", async () => {
    const call = (fp: string) =>
      db.rows<{ r: { allowed: boolean; retry_after_seconds: number } }>(service,
        "select public.consume_rate_limit('otp_request_fingerprint', $1) as r", [fp]).then((rows) => rows[0].r.allowed);
    expect([await call("fp-a"), await call("fp-a"), await call("fp-a")]).toEqual([true, true, false]);
    expect(await call("fp-b")).toBe(true);
  });

  test("fixed window is atomic per subject and reports retry time", async () => {
    const call = (subject: string) =>
      db.rows<{ r: { allowed: boolean; retry_after_seconds: number } }>(service,
        "select public.consume_rate_limit('otp_send_phone_cooldown', $1) as r", [subject]).then((rows) => rows[0].r);
    expect(await call("+919000000001")).toEqual({ allowed: true, retry_after_seconds: 0 });
    const blocked = await call("+919000000001");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after_seconds).toBeGreaterThan(0);
    expect(blocked.retry_after_seconds).toBeLessThanOrEqual(60);
    expect((await call("+919000000002")).allowed).toBe(true);
    // Raw subjects are not stored.
    expect(await db.sql("select key from app.rate_limits where key like '%9000000001%'")).toEqual([]);
  });
});
