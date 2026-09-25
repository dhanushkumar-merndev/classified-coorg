import { test as setup, expect } from "@playwright/test";
import { existsSync, statSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

// Logs each staging role in once through the real phone-OTP flow (fixed codes
// from supabase/config.toml [auth.sms.test_otp]) and saves the session. The
// per-number OTP send limit is 60 s, so sessions are reused across specs.
// Login codes are limited to 2 per minute per browser fingerprint; each role
// signs in from its own locale so the five logins count as separate browsers.
const LOCALE = { SELLER: "en-IN", ADMIN: "en-GB", BUYER: "en-US", SUPER_ADMIN: "en-AU", AGENT: "en-CA" } as const;

for (const role of ["SELLER", "ADMIN", "BUYER", "SUPER_ADMIN", "AGENT"] as const) {
  setup(`sign in ${role}`, async ({ browser }) => {
    setup.setTimeout(150_000);
    const file = `e2e/.auth/${role.toLowerCase()}.json`;
    // Sessions last an hour; reuse a fresh one so reruns don't hit the OTP send limit.
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 30 * 60_000) return;
    const context = await browser.newContext({ locale: LOCALE[role] });
    const page = await context.newPage();
    const phone = process.env[`E2E_${role}_PHONE`]?.replace(/^\+?91/, "");
    const otp = process.env[`E2E_${role}_OTP`];
    expect(phone && otp, `E2E_${role}_PHONE / _OTP must be set in .env`).toBeTruthy();

    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/login?next=/dashboard");
      await page.locator("#phone").fill(phone!);
      await page.getByRole("button", { name: /send code/i }).click();
      const wait = page.getByText(/Try again in \d+s/);
      const outcome = await Promise.race([
        page.locator("#otp").waitFor({ timeout: 15_000 }).then(() => "otp" as const),
        wait.waitFor({ timeout: 15_000 }).then(() => "limited" as const),
      ]);
      if (outcome === "otp") break;
      const secs = Number((await wait.innerText()).match(/(\d+)s/)![1]);
      await page.waitForTimeout((secs + 2) * 1000);
    }
    await page.locator("#otp").pressSequentially(otp!);
    await page.waitForURL((u) => u.pathname.startsWith("/dashboard"), { timeout: 20_000 });
    await context.storageState({ path: `e2e/.auth/${role.toLowerCase()}.json` });
    await context.close();
  });
}
