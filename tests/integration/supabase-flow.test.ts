// Live end-to-end check against the linked staging Supabase project and the
// staging Tigris buckets, through the real application services and real
// user JWTs (never the service role for actor assertions, test.md §4.2).
//
// Runs only when SUPABASE_SECRET_KEY, Tigris credentials and the E2E_* test
// phone numbers are present. Phone OTP is the only auth path (AUTH-015), and
// the SMS hook is not deployed yet, so arbitrary new phone numbers cannot be
// verified here: real OTP delivery only works for the fixed numbers already
// registered in supabase/config.toml [auth.sms.test_otp]. This suite signs
// in as the same three staging role accounts scripts/staging-accounts.mjs
// provisions (SELLER/ADMIN/BUYER), the same accounts used for manual QA
// login, rather than one-off random users.
//
// Audit/revision tables are append-only, and properties.owner_id is
// on-delete-restrict, so the created listing is soft-deleted (not removed)
// and the accounts themselves are never suspended or deleted here: doing so
// would break the shared QA login. beforeAll defensively reactivates them in
// case a previous run crashed mid-suite (e.g. after the suspension test).
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
// E2E_LISTER=agent lists with the staging agent account (also a listing role)
// when the staging seller has used today's draft allowance.
const roleEnv = { seller: process.env.E2E_LISTER === "agent" ? "AGENT" : "SELLER", admin: "ADMIN", buyer: "BUYER" } as const;
const configured = Boolean(
  url && publishable && secret && process.env.TIGRIS_STORAGE_ACCESS_KEY_ID
  && Object.values(roleEnv).every((key) => process.env[`E2E_${key}_PHONE`] && process.env[`E2E_${key}_OTP`]),
);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const run = randomUUID().slice(0, 8);

describe.skipIf(!configured)("staging Supabase + Tigris listing flow (live)", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const users: Record<keyof typeof roleEnv, { id: string; client: SupabaseClient }> = {} as never;
  let propertyId: string;

  async function makeUser(role: keyof typeof roleEnv) {
    const phone = process.env[`E2E_${roleEnv[role]}_PHONE`]!;
    const otp = process.env[`E2E_${roleEnv[role]}_OTP`]!;
    const client = createClient(url!, publishable!, noSession);
    const sent = await client.auth.signInWithOtp({ phone });
    if (sent.error) throw sent.error;
    const { data, error } = await client.auth.verifyOtp({ phone, token: otp, type: "sms" });
    if (error || !data.user) throw error ?? new Error(`OTP verify failed for ${role}`);
    return { id: data.user.id, client };
  }

  async function version() {
    const { data } = await users.seller.client.from("properties").select("version, current_revision_id").eq("id", propertyId).single();
    return data!;
  }

  async function reactivate(id: string) {
    await service.from("profiles").update({ is_suspended: false, suspended_at: null, suspension_reason: null }).eq("id", id);
  }

  beforeAll(async () => {
    service = createClient(url!, secret!, noSession);
    anon = createClient(url!, publishable!, noSession);
    users.seller = await makeUser("seller");
    users.admin = await makeUser("admin");
    users.buyer = await makeUser("buyer");
    for (const u of Object.values(users)) await reactivate(u.id);
  });

  afterAll(async () => {
    if (propertyId) await service.from("properties").update({ deleted_at: new Date().toISOString() }).eq("id", propertyId);
    for (const u of Object.values(users)) await reactivate(u.id);
  });

  test("buyer session is least-privilege: only its own role, only its own profile", async () => {
    const { data: roles } = await users.buyer.client.from("user_roles").select("role_id");
    expect(roles).toEqual([{ role_id: 1 }]);
    const { data: others } = await users.buyer.client.from("profiles").select("id").neq("id", users.buyer.id);
    expect(others).toEqual([]);
  });

  test("buyer cannot list, seller onboards and creates a draft", async () => {
    const denied = await users.buyer.client.from("properties").insert({ title: "Buyer attempt" });
    expect(denied.error?.code).toBe("42501");

    const onboard = await users.seller.client.rpc("become_seller", { p_seller_type: "owner" });
    expect(onboard.error).toBeNull();

    const { data: location } = await anon.from("locations").select("id").eq("slug", "madikeri").single();
    const { data, error } = await users.seller.client.from("properties").insert({
      title: `Test coffee estate ${run}`,
      description: "Automated staging test listing with water, road access and a small coffee plantation.",
      property_type: "coffee_estate", seller_type: "owner", price: "25000000", area_value: "5", area_unit: "acre",
      location_id: location!.id,
    }).select("id, status, version, price_per_unit").single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "draft", version: 1, price_per_unit: 5000000 });
    propertyId = data!.id;

    const { data: hidden } = await anon.from("properties").select("id").eq("id", propertyId);
    expect(hidden).toEqual([]);
  });

  test("photo and document go through quarantine, validation and immutable finalize", async () => {
    const { initiateUpload, finalizeUpload } = await import("@/services/upload.service");
    const actor = { id: users.seller.id, phone: null, fullName: null, roles: new Set(["seller" as const]), isSuspended: false };

    const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#3b6d3f" } }).jpeg().toBuffer();
    const image = await initiateUpload(actor, {
      kind: "property_image", propertyId, fileName: "estate.jpg", contentType: "image/jpeg", size: jpeg.length,
    });
    const put = await fetch(image.upload.url, { method: "PUT", headers: image.upload.headers, body: jpeg });
    expect(put.status).toBe(200);
    const media = await finalizeUpload(actor, image.sessionId);
    expect(media.replayed).toBe(false);
    expect(await finalizeUpload(actor, image.sessionId)).toEqual({ ...media, replayed: true });

    // Too small for the photo rules: refused after upload, never stored.
    const tiny = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#777777" } }).jpeg().toBuffer();
    const small = await initiateUpload(actor, { kind: "property_image", propertyId, fileName: "tiny.jpg", contentType: "image/jpeg", size: tiny.length });
    await fetch(small.upload.url, { method: "PUT", headers: small.upload.headers, body: tiny });
    await expect(finalizeUpload(actor, small.sessionId)).rejects.toMatchObject({ code: "UPLOAD_REJECTED" });

    // Photo rules for submission: 4+ photos with one portrait and one landscape.
    for (const [width, height] of [[1600, 900], [1200, 900], [800, 1200]]) {
      const bytes = await sharp({ create: { width, height, channels: 3, background: "#4d7a52" } }).jpeg().toBuffer();
      const session = await initiateUpload(actor, { kind: "property_image", propertyId, fileName: `p${width}.jpg`, contentType: "image/jpeg", size: bytes.length });
      expect((await fetch(session.upload.url, { method: "PUT", headers: session.upload.headers, body: bytes })).status).toBe(200);
      await finalizeUpload(actor, session.sessionId);
    }

    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
    const doc = await initiateUpload(actor, {
      kind: "property_document", propertyId, documentType: "rtc", fileName: "rtc.pdf", contentType: "application/pdf", size: pdf.length,
    });
    expect((await fetch(doc.upload.url, { method: "PUT", headers: doc.upload.headers, body: pdf })).status).toBe(200);
    await finalizeUpload(actor, doc.sessionId);

    const unsafe = Buffer.from("%PDF-1.4\n/OpenAction << /S /JavaScript /JS (app.alert(1)) >>\n%%EOF\n");
    const bad = await initiateUpload(actor, {
      kind: "property_document", propertyId, documentType: "other", fileName: "x.pdf", contentType: "application/pdf", size: unsafe.length,
    });
    await fetch(bad.upload.url, { method: "PUT", headers: bad.upload.headers, body: unsafe });
    await expect(finalizeUpload(actor, bad.sessionId)).rejects.toMatchObject({ code: "UPLOAD_REJECTED" });

    const { data: docs } = await users.seller.client.from("property_documents").select("id").eq("property_id", propertyId);
    expect(docs).toHaveLength(1);
    const { data: buyerDocs } = await users.buyer.client.from("property_documents").select("id").eq("property_id", propertyId);
    expect(buyerDocs).toEqual([]);
  });

  test("submit, review and approve publish the listing; content is then locked", async () => {
    const submit = await users.seller.client.rpc("transition_property", {
      p_property_id: propertyId, p_action: "submit", p_expected_version: (await version()).version,
    });
    expect(submit.error).toBeNull();

    const selfish = await users.seller.client.rpc("transition_property", {
      p_property_id: propertyId, p_action: "begin_review", p_expected_version: (await version()).version,
      p_revision_id: (await version()).current_revision_id,
    });
    expect(selfish.error?.message).toBe("INVALID_STATUS_TRANSITION");

    for (const action of ["begin_review", "approve"]) {
      const v = await version();
      const res = await users.admin.client.rpc("transition_property", {
        p_property_id: propertyId, p_action: action, p_expected_version: v.version, p_revision_id: v.current_revision_id,
      });
      expect(res.error, action).toBeNull();
    }

    const { data: visible } = await anon.from("properties").select("id, status, verification_status").eq("id", propertyId);
    expect(visible).toEqual([{ id: propertyId, status: "verified", verification_status: "verified" }]);
    const { data: media } = await anon.from("property_media").select("id").eq("property_id", propertyId);
    expect(media).toHaveLength(4);
    // Broker model: the public API never returns the owner or exact location.
    const { error: ownerLeak } = await anon.from("properties").select("owner_id").eq("id", propertyId);
    expect(ownerLeak?.code).toBe("42501");

    const locked = await users.seller.client.from("properties").update({ price: "1" }).eq("id", propertyId).select("id");
    expect(locked.data).toEqual([]);
  });

  test("enquiry: idempotent for the buyer, no self-contact, visible to the buyer and platform only", async () => {
    const key = randomUUID();
    const first = await users.buyer.client.rpc("create_enquiry", { p_property_id: propertyId, p_message: "Is the road motorable?", p_idempotency_key: key });
    const again = await users.buyer.client.rpc("create_enquiry", { p_property_id: propertyId, p_message: "Is the road motorable?", p_idempotency_key: key });
    expect(first.error).toBeNull();
    expect(again.data).toEqual({ enquiry_id: first.data.enquiry_id, replayed: true });

    const self = await users.seller.client.rpc("create_enquiry", { p_property_id: propertyId, p_message: null, p_idempotency_key: randomUUID() });
    expect(self.error?.message).toBe("SELF_ENQUIRY_FORBIDDEN");

    const { data: sellerView } = await users.seller.client.from("enquiries").select("buyer_id").eq("property_id", propertyId);
    expect(sellerView).toEqual([]);
    const { data: adminView } = await users.admin.client.from("enquiries").select("buyer_id").eq("property_id", propertyId);
    expect(adminView).toEqual([{ buyer_id: users.buyer.id }]);
    const { data: counts } = await users.seller.client.rpc("seller_enquiry_counts");
    expect((counts as Array<{ property_id: string }>).find((c) => c.property_id === propertyId))
      .toEqual({ property_id: propertyId, total: 1, unread: 1 });
    const { error: nameLeak } = await anon.rpc("get_listing_seller", { p_property_id: propertyId });
    expect(nameLeak?.code).toBe("42501");
  });

  test("suspension hides the listing immediately for existing sessions", async () => {
    const res = await users.admin.client.rpc("admin_set_suspension", { p_user_id: users.seller.id, p_suspended: true, p_reason: "Automated test check" });
    expect(res.error).toBeNull();
    const { data } = await anon.from("properties").select("id").eq("id", propertyId);
    expect(data).toEqual([]);
    const write = await users.seller.client.rpc("transition_property", {
      p_property_id: propertyId, p_action: "mark_sold", p_expected_version: (await service.from("properties").select("version").eq("id", propertyId).single()).data!.version,
    });
    expect(write.error?.message).toBe("ACCOUNT_SUSPENDED");
  });
});
