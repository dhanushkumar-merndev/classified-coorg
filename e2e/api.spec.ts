import { expect, test } from "@playwright/test";

const ID = "00000000-0000-4000-8000-000000000000";

test("uploads require a session", async ({ request }) => {
  const res = await request.post("/api/uploads", { data: {}, headers: { origin: "http://localhost:3000" } });
  expect([401, 403]).toContain(res.status());
});

test("uploads reject a foreign origin", async ({ request }) => {
  const res = await request.post("/api/uploads", { data: {}, headers: { origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("SMS hook rejects unsigned calls", async ({ request }) => {
  const res = await request.post("/api/auth/sms-hook", { data: { user: { phone: "+919000000001" }, sms: { otp: "123456" } } });
  expect(res.status()).toBe(401);
});

test("documents are hidden from signed-out callers", async ({ request }) => {
  expect((await request.get(`/api/documents/${ID}`)).status()).toBe(404);
});

test("unknown media is a plain 404", async ({ request }) => {
  expect((await request.get(`/media/${ID}/full`)).status()).toBe(404);
});

test("job endpoints refuse requests without the cron secret", async ({ request }) => {
  expect((await request.get("/api/jobs/notifications")).status()).toBe(401);
  expect((await request.get("/api/jobs/maintenance")).status()).toBe(401);
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
});
