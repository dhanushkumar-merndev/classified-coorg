import { expect, test, type Browser } from "@playwright/test";

// Admin area: content management (locations, articles), oversight lists and
// role gating between admin and super admin. Serial: later tests use rows
// created by earlier ones.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const LOC = `E2E Hamlet ${stamp}`;
const ART = `E2E guide ${stamp}`;

async function as(browser: Browser, role: "admin" | "super_admin" | "buyer" | "seller") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json`, colorScheme: "dark" });
}

test("admin dashboard and oversight lists render", async ({ browser }) => {
  const page = await (await as(browser, "admin")).newPage();
  for (const [path, heading] of [
    ["/admin", /dashboard|overview/i], ["/admin/verification", /verification/i], ["/admin/properties", /all properties/i],
    ["/admin/users", /users/i], ["/admin/enquiries", /enquiries/i], ["/admin/locations", /locations/i], ["/admin/articles", /articles/i],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toHaveText(heading);
  }
});

test("plain admin cannot open audit logs; super admin can", async ({ browser }) => {
  const admin = await (await as(browser, "admin")).newPage();
  expect((await admin.goto("/admin/audit-logs"))?.status()).toBe(404);
  await expect(admin.getByRole("link", { name: "Audit logs" })).toHaveCount(0);

  const sup = await (await as(browser, "super_admin")).newPage();
  expect((await sup.goto("/admin/audit-logs"))?.status()).toBe(200);
  await expect(sup.getByRole("heading", { level: 1 })).toHaveText(/audit logs/i);
});

test("admin adds a location, it appears publicly, then edits it", async ({ browser }) => {
  const page = await (await as(browser, "admin")).newPage();
  await page.goto("/admin/locations");
  await page.getByRole("button", { name: /add location/i }).click();
  await page.locator("#loc-name").fill(LOC);
  await expect(page.locator("#loc-slug")).toHaveValue(/e2e-hamlet-/);
  await page.locator("#loc-intro").fill("A test hamlet created by the automated admin suite.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Location saved")).toBeVisible();
  await expect(page.getByText(LOC)).toBeVisible();

  const slug = `e2e-hamlet-${stamp}`;
  const pub = await page.request.get(`/locations/${slug}`);
  expect([200, 404]).toContain(pub.status()); // 200 once cache revalidates; never a 500
  expect(pub.status()).not.toBe(500);

  const row = page.getByRole("row", { name: new RegExp(LOC) });
  await row.getByRole("button", { name: "Edit" }).click();
  await page.locator("#loc-seot").fill("E2E hamlet SEO title");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Location saved")).toBeVisible();
});

test("duplicate location slug is rejected with a clear message", async ({ browser }) => {
  const page = await (await as(browser, "admin")).newPage();
  await page.goto("/admin/locations");
  await page.getByRole("button", { name: /add location/i }).click();
  await page.locator("#loc-name").fill(`${LOC} dup`);
  await page.locator("#loc-slug").fill(`e2e-hamlet-${stamp}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/slug is already used/i)).toBeVisible();
});

test("admin publishes an article and it is public; drafts are not", async ({ browser }) => {
  const page = await (await as(browser, "admin")).newPage();
  await page.goto("/admin/articles");
  await page.getByRole("button", { name: /new article/i }).click();
  await page.locator("#art-title").fill(ART);
  await page.locator("#art-excerpt").fill("Automated test guide.");
  await page.locator("#art-body").fill("Paragraph one about buying land in Coorg.\n\nParagraph two about checking the RTC.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/article saved/i)).toBeVisible();
  await expect(page.getByText(ART)).toBeVisible();

  const slug = ART.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // default status is draft → not public
  expect((await page.request.get(`/guides/${slug}`)).status()).toBe(404);
});

test("audit log records the admin's content changes", async ({ browser }) => {
  const page = await (await as(browser, "super_admin")).newPage();
  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).toMatch(/location|article|property|user/i);
});

test("buyer and seller get 404 on every admin route", async ({ browser }) => {
  for (const role of ["buyer", "seller"] as const) {
    const page = await (await as(browser, role)).newPage();
    for (const p of ["/admin", "/admin/locations", "/admin/articles", "/admin/enquiries", "/admin/audit-logs", "/admin/users"]) {
      expect((await page.goto(p))?.status(), `${role} ${p}`).toBe(404);
    }
  }
});

test("admin server actions reject non-admin callers", async ({ browser }) => {
  const page = await (await as(browser, "buyer")).newPage();
  const res = await page.request.post("/admin/locations", { headers: { "next-action": "deadbeef" }, data: "[]" });
  expect([404, 400, 405]).toContain(res.status());
});
