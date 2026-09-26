import { expect, test } from "@playwright/test";

const PAGES = ["/", "/properties", "/locations", "/locations/madikeri", "/property-types", "/guides", "/verification", "/disclaimer", "/login"];

for (const path of PAGES) {
  test(`public page renders: ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });
}

test("unknown route shows the friendly 404", async ({ page }) => {
  const res = await page.goto("/property/does-not-exist-000000");
  expect(res?.status()).toBe(404);
  await expect(page.getByText(/not found|no longer available/i).first()).toBeVisible();
});

test("a public listing opens its property detail page", async ({ page }) => {
  await page.goto("/properties");
  const listing = page.locator("main a[href^='/property/']").first();
  await expect(listing).toBeVisible();
  const title = (await listing.innerText()).trim();
  const href = await listing.getAttribute("href");
  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

test("all public pages share one content width (no layout switch)", async ({ page }) => {
  const lefts = new Set<number>();
  for (const path of ["/", "/locations", "/property-types", "/guides", "/verification"]) {
    await page.goto(path);
    lefts.add(Math.round((await page.locator("h1").first().boundingBox())!.x));
  }
  expect(lefts.size).toBe(1);
});

test("opening a dropdown does not shift the page", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 1000 });
  const before = (await page.locator("h1").first().boundingBox())!.x;
  await page.locator("#hero-type").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.locator("#hero-type").click();
  await expect(page.getByRole("option", { name: "Coffee estate" })).toBeVisible();
  expect((await page.locator("h1").first().boundingBox())!.x).toBe(before);
  const trigger = (await page.locator("#hero-type").boundingBox())!;
  const list = (await page.getByRole("listbox").boundingBox())!;
  expect(list.y).toBeGreaterThanOrEqual(trigger.y + trigger.height - 1);
});

test("hero search navigates with filters in the URL", async ({ page }) => {
  await page.goto("/");
  await page.locator("#hero-type").click();
  await page.getByRole("option", { name: "Coffee estate" }).click();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/properties\?type=coffee-estate/);
});

test("private areas redirect signed-out visitors to login", async ({ page }) => {
  await page.goto("/dashboard/properties");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("robots and sitemap are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /admin");
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
});

test("header stays pinned when a dropdown opens after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1342, height: 900 });
  await page.goto("/properties");
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.getByLabel("Sort results").click();
  await expect(page.getByRole("listbox")).toBeVisible();
  expect(await page.evaluate(() => document.querySelector("header")!.getBoundingClientRect().top)).toBe(0);
});

test("guides list real articles and a guide renders headings and lists", async ({ page }) => {
  await page.goto("/guides");
  const first = page.locator("main a[href^='/guides/']").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/guides\/[a-z0-9-]+$/);
  expect(await page.locator("article h2").count()).toBeGreaterThan(1);
  await expect(page.locator("article li").first()).toBeVisible();
  // A heading owns only its own line, never the paragraph under it.
  for (const h of await page.locator("article h2").allInnerTexts()) expect(h.length).toBeLessThan(80);
});

test("login card is centred in the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1342, height: 900 });
  await page.goto("/login");
  const box = (await page.locator("[data-slot=card]").boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 1342 / 2)).toBeLessThan(12);
  expect(Math.abs(box.y + box.height / 2 - 900 / 2)).toBeLessThan(60);
});
