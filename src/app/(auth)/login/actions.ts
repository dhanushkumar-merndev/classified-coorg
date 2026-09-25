"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { runAction } from "@/lib/api/response";
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

/** Widget path: exchanges MSG91's access token for a session. */
export async function verifyWidgetLoginAction(input: { phone: string; accessToken: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyWidget", () => auth.signInWithWidgetToken({ ...input, ip }));
}

/** Server-mode widget: MSG91 checks the code from our server. */
export async function verifyWidgetCodeAction(input: { phone: string; reqId: string; code: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyWidgetCode", () => auth.verifyWidgetCode({ ...input, ip }));
}

export async function verifyOtpAction(input: { phone: string; token: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyOtp", () => auth.verifyOtp({ ...input, ip }));
}

export async function signOutAction() {
  await auth.signOut();
  redirect("/");
}
