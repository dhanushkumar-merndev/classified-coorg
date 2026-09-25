import { expect, test } from "@playwright/test";

// MSG91 widget login, with MSG91's browser script replaced by a stub so no SMS
// is sent. The stub hands back a forged access token; the server re-checks it
// with the real MSG91 API, which must refuse it — so no session is created.
const STUB = `
  window.initSendOTP = function () {
    window.getWidgetData = function () { return { otpLength: 4, retryTime: 10 }; };
    window.sendOtp = function (identifier, ok) { window.__sentTo = identifier; ok({ type: "success", message: "req-123" }); };
    window.retryOtp = function (channel, ok) { ok({ type: "success" }); };
    window.verifyOtp = function (otp, ok, fail) {
      if (otp !== "1234") return fail({ type: "error", message: "OTP not match" });
      ok({ type: "success", message: "eyJhbGciOiJIUzI1NiJ9.eyJtb2JpbGUiOiI5MTk4NzY1NDMyMTAifQ.forged" });
    };
  };`;

test.beforeEach(async ({ page }) => {
  for (const host of ["https://verify.msg91.com/**", "https://verify.phone91.com/**"]) {
    await page.route(host, (route) => route.fulfill({ contentType: "text/javascript", body: STUB }));
  }
});

// Each group signs in as a different "browser" (locale changes the
// fingerprint), because codes are limited to 2 per minute per browser.
test.describe("widget path", () => { test.use({ locale: "en-GB" });
test("a real number uses the widget; a wrong code is refused by MSG91", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#phone").fill("9876543210");
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByText("4-digit code")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sentTo: string }).__sentTo)).toBe("919876543210");

  await page.locator("#otp").pressSequentially("9999");
  await expect(page.getByText(/incorrect or has expired/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

}); // widget path

test.describe("forged token", () => { test.use({ locale: "en-AU" });
test("a forged access token never opens a session", async ({ page, context }) => {
  await page.goto("/login?next=/dashboard");
  await page.locator("#phone").fill("9876543210");
  await page.getByRole("button", { name: /send code/i }).click();
  await page.locator("#otp").pressSequentially("1234");
  await expect(page.getByText(/incorrect or has expired/i)).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login/);
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.includes("auth-token"))).toBe(false);
});

}); // forged token

test.describe("fingerprint limit", () => { test.use({ locale: "fr-FR" });
test("a browser gets at most 2 code requests per minute", async ({ page }) => {
  await page.goto("/login");
  const outcomes: string[] = [];
  for (let i = 0; i < 3; i++) {
    await page.locator("#phone").fill(`98765432${10 + i}`);
    await page.getByRole("button", { name: /send code/i }).click();
    const result = await Promise.race([
      page.getByText(/digit code/).waitFor().then(() => "sent"),
      page.getByText(/Too many code requests/).waitFor().then(() => "limited"),
    ]);
    outcomes.push(result);
    if (result === "sent") await page.getByRole("button", { name: /change number/i }).click();
  }
  expect(outcomes).toEqual(["sent", "sent", "limited"]);
});
}); // fingerprint limit

test("login CSP allows MSG91 only on /login", async ({ request }) => {
  const login = (await request.get("/login")).headers()["content-security-policy"] ?? "";
  const home = (await request.get("/")).headers()["content-security-policy"] ?? "";
  expect(login).toContain("https://verify.msg91.com");
  expect(home).not.toContain("msg91");
});
