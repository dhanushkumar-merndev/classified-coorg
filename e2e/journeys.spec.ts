import { expect, test, type Browser } from "@playwright/test";
import sharp from "sharp";

// Full loop across three real roles (staging accounts): seller lists, admin
// verifies, buyer finds and enquires, seller sees the enquiry. Runs serially.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const TITLE = `E2E coffee estate near Madikeri ${stamp}`;
let listingId = "";
let slug = "";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

// E2E_LISTER=agent lists with the staging agent account (also a listing role)
// when the staging seller has used today's draft allowance.
const LISTER = process.env.E2E_LISTER === "agent" ? "agent" : "seller";
const LISTER_NAME = LISTER === "agent" ? "Staging Agent" : "Staging Seller";

async function as(browser: Browser, role: "seller" | "agent" | "admin" | "buyer") {
  return browser.newContext({ storageState: `e2e/.auth/${role}.json`, colorScheme: "dark" });
}

// Safety net: if a step fails after approval, still retire the test listing so
// staging never keeps public "E2E …" listings (the last test does this normally).
test.afterAll(async ({ browser }) => {
  if (!listingId) return;
  const ctx = await as(browser, LISTER);
  const page = await ctx.newPage();
  await page.goto(`/dashboard/properties/${listingId}`);
  for (const name of ["Mark as sold", "Archive"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (!(await button.count())) continue;
    await button.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await page.getByText(`${name} done`).waitFor({ timeout: 15_000 }).catch(() => {});
    await page.reload();
  }
  await ctx.close();
});

test("seller creates a draft, fills it in, uploads files and submits", async ({ browser }) => {
  const ctx = await as(browser, LISTER);
  const page = await ctx.newPage();

  await page.goto("/dashboard/properties/new");
  await page.getByText("Coffee estate", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/dashboard\/properties\/[0-9a-f-]{36}\/edit/);
  listingId = page.url().match(/properties\/([0-9a-f-]{36})/)![1]!;

  await page.locator("#title").fill(TITLE);
  await page.locator("#description").fill("Well maintained Arabica and Robusta estate with a perennial stream, motorable road access and a farmhouse. Shade trees and pepper vines throughout.");
  await page.locator("#price").fill("25000000");
  await page.locator("#area_value").fill("5");
  const combos = page.getByRole("tabpanel").getByRole("combobox");
  await combos.nth(1).click();
  await page.getByRole("option", { name: "Owner" }).click();
  await combos.nth(2).click();
  await page.getByRole("option", { name: "acres" }).click();

  await expect(page.getByTestId("save-state")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Location" }).click();
  await page.getByRole("tabpanel").getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Madikeri" }).click();
  await expect(page.getByTestId("save-state")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: /Photos/ }).click();
  const photo = (width: number, height: number, background: string) =>
    sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer();
  // A photo below 1200 × 800 is refused in the browser, before any upload.
  await page.locator("#photo-input").setInputFiles({ name: "tiny.jpg", mimeType: "image/jpeg", buffer: await photo(600, 400, "#777777") });
  await expect(page.getByText(/Too small \(600 × 400 px\)/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Photos (0)" })).toBeVisible();
  // Rules: at least 4 photos, one portrait and one landscape.
  const files = [
    { name: "estate-1.jpg", mimeType: "image/jpeg", buffer: await photo(1200, 800, "#3b6d3f") },
    { name: "estate-2.jpg", mimeType: "image/jpeg", buffer: await photo(1600, 900, "#4d7a52") },
    { name: "estate-3.jpg", mimeType: "image/jpeg", buffer: await photo(1200, 900, "#5f8a63") },
    { name: "estate-4.jpg", mimeType: "image/jpeg", buffer: await photo(800, 1200, "#2f5a36") },
  ];
  await page.locator("#photo-input").setInputFiles(files);
  await expect(page.getByRole("tab", { name: "Photos (4)" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("portrait", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Photo requirements").getByText("done")).toHaveCount(3);

  await page.getByRole("tab", { name: /Documents/ }).click();
  await page.locator("input[type=file]").last().setInputFiles({ name: "rtc.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByRole("tab", { name: "Documents (1)" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("tab", { name: /Preview/ }).click();
  await expect(page.getByText("At least 4 photos").first()).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForURL(new RegExp(`/dashboard/properties/${listingId}$`), { timeout: 20_000 });
  await expect(page.getByText("Submitted").first()).toBeVisible();
  await ctx.close();
});

test("a submitted listing is locked for the owner and hidden from the public", async ({ browser, request }) => {
  const ctx = await as(browser, LISTER);
  const page = await ctx.newPage();
  await page.goto(`/dashboard/properties/${listingId}/edit`);
  await expect(page).toHaveURL(new RegExp(`/dashboard/properties/${listingId}$`));
  await ctx.close();
  await page.close();
  expect((await request.get(`/properties?q=${stamp}`)).status()).toBe(200);
  expect(await (await request.get(`/properties?q=${stamp}`)).text()).not.toContain(TITLE);
});

test("admin reviews the listing, opens the private document and approves", async ({ browser }) => {
  const ctx = await as(browser, "admin");
  const page = await ctx.newPage();
  await page.goto("/admin/verification");
  await page.getByRole("link", { name: TITLE }).click();
  await page.waitForURL(/\/admin\/verification\/[0-9a-f-]{36}/);

  const docHref = await page.getByRole("link", { name: /Open/ }).first().getAttribute("href");
  const doc = await ctx.request.get(docHref!);
  expect(doc.status()).toBe(200);
  expect(doc.headers()["content-disposition"]).toContain("attachment");

  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByText("Under review").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Approve/ }).click();
  await expect(page.getByText("Verified").first()).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("the approved listing is public and indexable", async ({ page }) => {
  await page.goto("/properties");
  const link = page.getByRole("link", { name: TITLE });
  await expect(link).toBeVisible({ timeout: 20_000 });
  slug = (await link.getAttribute("href"))!.replace("/property/", "");
  await link.click();
  await expect(page.locator("h1")).toHaveText(TITLE);
  await expect(page.getByText("Verified").first()).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  // Visual record of the public listing page (broker model: no seller name).
  await page.setViewportSize({ width: 1342, height: 900 });
  await page.screenshot({ path: "test-results/listing-page.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/listing-page-mobile.png", fullPage: true });
});

test("buyer saves the listing and sends one enquiry (double click is idempotent)", async ({ browser }) => {
  const ctx = await as(browser, "buyer");
  const page = await ctx.newPage();
  await page.goto(`/property/${slug}`);
  const save = page.locator("button[aria-pressed]").first();
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  // aria-pressed flips optimistically; wait for the server to confirm before leaving.
  await expect(page.getByText("Saved to your list")).toBeVisible({ timeout: 10_000 });
  await page.goto("/dashboard/saved");
  await expect(page.getByText(TITLE)).toBeVisible();

  await page.goto(`/property/${slug}`);
  // Broker model: no seller name or contact details on the page.
  await expect(page.getByText(LISTER_NAME)).toHaveCount(0);
  const contact = page.getByRole("button", { name: /enquire now/i }).first();
  await expect(contact).toBeEnabled({ timeout: 15_000 });
  await contact.click();
  await page.getByRole("textbox").last().fill("Is the road motorable throughout the year?");
  const send = page.getByRole("button", { name: /send/i }).last();
  await send.dblclick();
  await page.waitForTimeout(2_000);
  await page.goto("/dashboard/enquiries");
  await expect(page.getByText(TITLE)).toHaveCount(1);
  await ctx.close();
});

test("the enquiry reaches the platform team, never the seller", async ({ browser }) => {
  // Admin sees buyer and owner with phone numbers, and works the enquiry.
  const adminCtx = await as(browser, "admin");
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/enquiries?status=new");
  const card = admin.getByRole("listitem").filter({ hasText: TITLE }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText("Buyer", { exact: true })).toBeVisible();
  await expect(card.getByText("Owner", { exact: true })).toBeVisible();
  await expect(card.locator("a[href^='tel:']")).toHaveCount(2);
  await card.getByRole("button", { name: "Mark as called" }).click();
  await expect(admin.getByRole("listitem").filter({ hasText: TITLE })).toHaveCount(0, { timeout: 15_000 });
  await adminCtx.close();

  // The seller only sees that a buyer is interested.
  const ctx = await as(browser, LISTER);
  const page = await ctx.newPage();
  await page.goto("/dashboard/received");
  await expect(page).toHaveURL(/\/dashboard\/properties$/);
  await expect(page.getByText(/interested buyer/).first()).toBeVisible();
  await expect(page.getByText("Is the road motorable throughout the year?")).toHaveCount(0);
  await ctx.close();
});

test("a buyer cannot reach seller or admin areas", async ({ browser }) => {
  const ctx = await as(browser, "buyer");
  const page = await ctx.newPage();
  expect((await page.goto("/admin"))?.status()).toBe(404);
  await page.goto("/dashboard/properties/new");
  await expect(page).toHaveURL(/\/dashboard\/profile/);
  const res = await ctx.request.get(`/api/documents/${listingId}`);
  expect(res.status()).toBe(404);
  await ctx.close();
});

test("admin suspends the seller and the listing disappears; then reactivates", async ({ browser, request }) => {
  const ctx = await as(browser, "admin");
  const page = await ctx.newPage();
  await page.goto(`/admin/users?q=${LISTER_NAME}`);
  await page.getByRole("button", { name: "Manage" }).first().click();
  await page.getByPlaceholder("Reason").fill("E2E suspension check");
  await page.getByRole("button", { name: "Suspend account" }).click();
  await expect(page.getByText("Suspended").first()).toBeVisible({ timeout: 15_000 });
  expect((await request.get(`/property/${slug}`)).status()).toBe(404);

  await page.getByRole("button", { name: "Manage" }).first().click();
  await page.getByPlaceholder("Reason").fill("E2E cleanup");
  await page.getByRole("button", { name: "Reactivate account" }).click();
  await expect(page.getByText("Active").first()).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("seller marks the listing sold, then archives it (also cleans up staging)", async ({ browser, request }) => {
  const ctx = await as(browser, LISTER);
  const page = await ctx.newPage();
  await page.goto(`/dashboard/properties/${listingId}`);
  await page.getByRole("button", { name: "Mark as sold" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Mark as sold done")).toBeVisible({ timeout: 15_000 });
  const search = await request.get(`/properties?q=${encodeURIComponent(stamp)}`);
  expect(await search.text()).not.toContain(TITLE);

  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Archive done")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
  await ctx.close();
});
