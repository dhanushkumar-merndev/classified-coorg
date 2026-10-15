"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { runAction } from "@/lib/api/response";
import { normalizePhone } from "@/lib/auth/phone";
import { sendMetaEvent } from "@/lib/meta-capi";
import { clientIp } from "@/lib/request/client-ip";
import * as auth from "@/services/auth.service";

// Server actions for the phone OTP screens. They return the typed
// {data, error} envelope; the UI renders errors and never sees the OTP.

/** Rate-limit key for one browser: the client's fingerprint hash combined with
 *  request headers, so neither part alone can be reset by the caller. */
function fingerprintKey(h: Headers, clientFingerprint: unknown): string {
  const fp = typeof clientFingerprint === "string" && /^[a-f0-9]{64}$/.test(clientFingerprint) ? clientFingerprint : "none";
  return createHash("sha256")
    .update(`${fp}|${h.get("user-agent") ?? ""}|${h.get("accept-language") ?? ""}`)
    .digest("hex");
}

export async function requestOtpAction(input: { phone: string; fingerprint?: string }) {
  const h = await headers();
  return runAction("auth.requestOtp", () =>
    auth.requestOtp({ phone: input.phone, ip: clientIp(h), fingerprint: fingerprintKey(h, input.fingerprint) }));
}

/** First step: sends a Supabase code (test numbers, or widget disabled) or
 *  tells the browser to use the MSG91 widget. */
export async function startLoginAction(input: { phone: string; fingerprint?: string }) {
  const h = await headers();
  return runAction("auth.startLogin", () =>
    auth.startLogin({ phone: input.phone, ip: clientIp(h), fingerprint: fingerprintKey(h, input.fingerprint) }));
}

/** Signed in: send Meta the server copy of the Login event and give the
 *  browser its ID so the pixel's copy is deduplicated. The user ID stays on the
 *  server. Accounts without a name yet land on onboarding: a first login. */
function withLoginEvent(phone: string, session: { userId: string; redirectTo: string }) {
  const newUser = session.redirectTo.startsWith("/onboarding");
  const pixelEventId = sendMetaEvent("Login", { userId: session.userId, phone: normalizePhone(phone) }, { new_user: newUser });
  return { redirectTo: session.redirectTo, newUser, pixelEventId };
}

/** Widget path: exchanges MSG91's access token for a session. */
export async function verifyWidgetLoginAction(input: { phone: string; accessToken: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyWidget", async () => withLoginEvent(input.phone, await auth.signInWithWidgetToken({ ...input, ip })));
}

/** Server-mode widget: MSG91 checks the code from our server. */
export async function verifyWidgetCodeAction(input: { phone: string; reqId: string; code: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyWidgetCode", async () => withLoginEvent(input.phone, await auth.verifyWidgetCode({ ...input, ip })));
}

export async function verifyOtpAction(input: { phone: string; token: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyOtp", async () => withLoginEvent(input.phone, await auth.verifyOtp({ ...input, ip })));
}

/** Clears the session without navigating; the header menu then re-syncs the
 *  client account state itself (a redirect to the same path would not). */
export async function logOutAction() {
  await auth.signOut();
}

/** Form-action variant for pages without client account state. */
export async function signOutAction() {
  await auth.signOut();
  redirect("/");
}
