import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";
import { isValidOtp, maskPhone, normalizePhone } from "@/lib/auth/phone";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { widgetEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { deliverNotificationsSoon } from "@/services/notification.service";
import { looksLikeAccessToken, tokenShape, verifyWidgetAccessToken } from "@/services/sms/msg91-widget";
import { widgetMode, widgetSendOtp, widgetVerifyOtp } from "@/services/sms/msg91-widget-api";

// Phone OTP login (architecture §10–11, AUTH suite). Supabase Auth issues and
// verifies the code; MSG91 only delivers it via the Send SMS hook. Limits here
// protect the application path; the hook enforces per-phone limits for every
// path, including direct Auth API calls.

export const RESEND_COOLDOWN_SECONDS = 60;

export async function requestOtp(input: { phone: unknown; ip: string | null; fingerprint?: string; fingerprintChecked?: boolean }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("INVALID_PHONE");
  if (input.fingerprint && !input.fingerprintChecked) await enforceRateLimit("otp_request_fingerprint", input.fingerprint, "OTP_RATE_LIMITED");
  if (input.ip) await enforceRateLimit("otp_request_ip", input.ip, "OTP_RATE_LIMITED");

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: "sms", shouldCreateUser: true } });
  if (error) {
    // Hook denials (429 from our limiter) and Auth's own limits both surface here.
    if (error.status === 429 || /rate|too many|seconds/i.test(error.message)) {
      throw new AppError("OTP_RATE_LIMITED", { retryAfterSeconds: RESEND_COOLDOWN_SECONDS, cause: error });
    }
    logger.warn("auth.request_otp_failed", { status: error.status, code: error.code });
    throw new AppError("SMS_DELIVERY_FAILED", { cause: error });
  }
  return { phone, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

export async function verifyOtp(input: { phone: unknown; token: unknown; next?: unknown; ip: string | null }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("INVALID_PHONE");
  // Keep the code as a string: leading zeros are significant (AUTH-003).
  if (!isValidOtp(input.token)) throw new AppError("INVALID_OTP");

  await enforceRateLimit("otp_verify_phone", phone, "OTP_RATE_LIMITED");
  if (input.ip) await enforceRateLimit("otp_verify_ip", input.ip, "OTP_RATE_LIMITED");

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: input.token, type: "sms" });
  if (error || !data.session) {
    if (error?.status === 429) throw new AppError("OTP_RATE_LIMITED", { cause: error });
    throw new AppError("OTP_INVALID_OR_EXPIRED", { cause: error });
  }

  // Idempotent: the auth.users trigger normally created it already.
  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) logger.warn("auth.ensure_profile_failed", { code: profileError.code });
  deliverNotificationsSoon();

  return { redirectTo: safeNextPath(input.next) };
}

// ---------------------------------------------------------------------------
// MSG91 OTP widget path. MSG91 generates, sends and checks the code in the
// browser (no own DLT template needed). The server then re-verifies MSG91's
// access token, binds it to the phone MSG91 attests, and only then opens a
// Supabase session for that phone. Staging test numbers keep the Supabase OTP
// path so automated runs never send real SMS.

export type LoginStart =
  | { method: "supabase"; phone: string; resendAfterSeconds: number }
  | { method: "widget"; phone: string; identifier: string }
  | { method: "widget-server"; phone: string; reqId: string; codeLength: number; resendAfterSeconds: number };

export async function startLogin(input: { phone: unknown; ip: string | null; fingerprint?: string }): Promise<LoginStart> {
  const widget = widgetEnv();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("INVALID_PHONE");
  // 2 code requests per minute per browser (product decision), every path.
  if (input.fingerprint) await enforceRateLimit("otp_request_fingerprint", input.fingerprint, "OTP_RATE_LIMITED");
  if (!widget.enabled || widget.testPhones.has(phone)) {
    return { method: "supabase", ...(await requestOtp({ ...input, fingerprintChecked: true })) };
  }
  if (input.ip) await enforceRateLimit("otp_request_ip", input.ip, "OTP_RATE_LIMITED");
  if (widget.authKeyIsWidgetToken) {
    // Codes could be sent but never confirmed; refuse before spending an SMS.
    logger.error("auth.msg91_authkey_misconfigured", { hint: "MSG91_AUTH_KEY equals the widget tokenAuth; set the account authkey" });
    throw new AppError("DEPENDENCY_FAILED");
  }

  // Captcha off in the widget settings → send from our server (works in every
  // browser, our per-phone limits apply). Captcha on → the browser widget.
  const mode = await widgetMode(widget.widgetId, widget.tokenAuth);
  if (!mode.serverSide || !widget.serverSmsAllowed(phone)) return { method: "widget", phone, identifier: phone.slice(1) };

  for (const action of ["otp_send_phone_cooldown", "otp_send_phone_hourly", "otp_send_phone_daily"] as const) {
    await enforceRateLimit(action, phone, "OTP_RATE_LIMITED");
  }
  const sent = await widgetSendOtp(widget.widgetId, widget.tokenAuth, phone.slice(1));
  if (!sent.ok) {
    logger.warn("auth.widget_send_failed", { phone: maskPhone(phone), reason: sent.reason, message: sent.message });
    if (/limit|many|exceed/i.test(sent.message)) throw new AppError("OTP_RATE_LIMITED", { retryAfterSeconds: mode.retrySeconds });
    throw new AppError("SMS_DELIVERY_FAILED");
  }
  // Resend goes through startLogin again, so the timer must cover our own
  // per-phone cooldown too, not just MSG91's retry time.
  return { method: "widget-server", phone, reqId: sent.reqId, codeLength: mode.otpLength, resendAfterSeconds: Math.max(mode.retrySeconds, RESEND_COOLDOWN_SECONDS) };
}

/** Server-mode widget: checks the code with MSG91, then opens the session. */
export async function verifyWidgetCode(input: { phone: unknown; reqId: unknown; code: unknown; next?: unknown; ip: string | null }) {
  const widget = widgetEnv();
  if (!widget.enabled) throw new AppError("NOT_FOUND");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("INVALID_PHONE");
  if (typeof input.code !== "string" || !/^\d{4,8}$/.test(input.code)) throw new AppError("INVALID_OTP");
  if (typeof input.reqId !== "string" || !/^[\w-]{6,100}$/.test(input.reqId)) throw new AppError("OTP_INVALID_OR_EXPIRED");

  await enforceRateLimit("otp_verify_phone", phone, "OTP_RATE_LIMITED");
  if (input.ip) await enforceRateLimit("otp_verify_ip", input.ip, "OTP_RATE_LIMITED");

  const checked = await widgetVerifyOtp(widget.widgetId, widget.tokenAuth, input.reqId, input.code);
  if (!checked.ok) {
    if (checked.reason === "unavailable") throw new AppError("DEPENDENCY_FAILED");
    throw new AppError("OTP_INVALID_OR_EXPIRED");
  }
  return completeWidgetLogin(phone, checked.accessToken, input.next);
}

export async function signInWithWidgetToken(input: { phone: unknown; accessToken: unknown; next?: unknown; ip: string | null }) {
  const widget = widgetEnv();
  if (!widget.enabled) throw new AppError("NOT_FOUND");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("INVALID_PHONE");
  if (!looksLikeAccessToken(input.accessToken)) {
    logger.warn("auth.widget_token_malformed", { phone: maskPhone(phone), shape: tokenShape(input.accessToken) });
    devTrace("widget_token_malformed", { shape: tokenShape(input.accessToken) });
    throw new AppError("OTP_INVALID_OR_EXPIRED");
  }

  await enforceRateLimit("otp_verify_phone", phone, "OTP_RATE_LIMITED");
  if (input.ip) await enforceRateLimit("otp_verify_ip", input.ip, "OTP_RATE_LIMITED");
  return completeWidgetLogin(phone, input.accessToken, input.next);
}

/** Shared tail of both widget modes: re-verify MSG91's token, bind it to the
 *  phone MSG91 attests, use it once, then open the Supabase session. */
async function completeWidgetLogin(phone: string, accessToken: string, next: unknown) {
  const widget = widgetEnv();
  const verdict = await verifyWidgetAccessToken(accessToken, { authKey: widget.authKey });
  if (!verdict.ok) {
    logger.warn("auth.widget_token_refused", { phone: maskPhone(phone), reason: verdict.reason, answer: verdict.answer, shape: tokenShape(accessToken) });
    devTrace("widget_token_refused", { reason: verdict.reason, answer: verdict.answer, shape: tokenShape(accessToken) });
    if (verdict.reason === "unavailable") throw new AppError("DEPENDENCY_FAILED");
    throw new AppError("OTP_INVALID_OR_EXPIRED");
  }
  // The browser only claims a number; MSG91's verified answer must contain it.
  if (!verdict.phones.includes(phone)) {
    logger.warn("auth.widget_phone_mismatch", { phone: maskPhone(phone), attested: verdict.phones.length, ...verdict.diagnostics });
    devTrace("widget_phone_mismatch", { attested: verdict.phones.map(maskPhone), ...verdict.diagnostics });
    throw new AppError("OTP_INVALID_OR_EXPIRED");
  }

  const service = createServiceClient();
  // Single use: a token that already opened a session cannot open another.
  const tokenId = createHash("sha256").update(accessToken).digest("hex");
  const { data: fresh, error: receiptError } = await service.rpc("register_webhook_receipt", { p_source: "msg91_widget", p_id: tokenId });
  if (receiptError) throw new AppError("DEPENDENCY_FAILED", { cause: receiptError });
  if (fresh !== true) {
    devTrace("widget_token_replayed", {});
    throw new AppError("OTP_INVALID_OR_EXPIRED");
  }

  const userId = await findOrCreatePhoneUser(service, phone);

  // Supabase has no admin "create session" call, so the session is opened with
  // a one-time random password that is replaced straight after sign-in and is
  // never stored or returned.
  const oneTime = randomSecret();
  const { error: setError } = await service.auth.admin.updateUserById(userId, { password: oneTime });
  if (setError) throw new AppError("DEPENDENCY_FAILED", { cause: setError });
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ phone, password: oneTime });
  const { error: rotateError } = await service.auth.admin.updateUserById(userId, { password: randomSecret() });
  if (rotateError) logger.error("auth.widget_password_rotate_failed", { phone: maskPhone(phone), code: rotateError.code });
  if (error || !data.session) {
    logger.warn("auth.widget_sign_in_failed", { phone: maskPhone(phone), status: error?.status, code: error?.code });
    throw new AppError("DEPENDENCY_FAILED", { cause: error });
  }

  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) logger.warn("auth.ensure_profile_failed", { code: profileError.code });
  deliverNotificationsSoon();
  logger.info("auth.widget_sign_in", { phone: maskPhone(phone) });
  devTrace("widget_sign_in_ok", { phone: maskPhone(phone) });
  return { redirectTo: safeNextPath(next) };
}

async function findOrCreatePhoneUser(service: ReturnType<typeof createServiceClient>, phone: string): Promise<string> {
  const authPhone = phone.slice(1); // Supabase stores phones without "+"
  const lookup = async () => {
    const { data, error } = await service.rpc("auth_user_id_by_phone", { p_phone: authPhone });
    if (error) throw new AppError("DEPENDENCY_FAILED", { cause: error });
    return (data as string | null) ?? null;
  };
  const existing = await lookup();
  if (existing) return existing;
  const { data, error } = await service.auth.admin.createUser({ phone: authPhone, phone_confirm: true });
  if (data?.user) return data.user.id;
  // Lost a race with a parallel first sign-in: the other request created it.
  const raced = await lookup();
  if (raced) return raced;
  throw new AppError("DEPENDENCY_FAILED", { cause: error });
}

/** Development only: appends a structure-only record (no tokens, codes or full
 *  numbers) to .scratch/auth-debug.log so login problems can be diagnosed
 *  without the terminal output. Never runs in production. */
function devTrace(event: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  void import("node:fs/promises")
    .then((fs) => fs.appendFile(".scratch/auth-debug.log", `${JSON.stringify({ at: new Date().toISOString(), event, ...data })}\n`))
    .catch(() => {});
}

function randomSecret(): string {
  return `${randomBytes(32).toString("base64url")}aA1!`;
}

export async function signOut() {
  const supabase = await createSessionClient();
  // Revokes this device's refresh token. An already-issued access token stays
  // valid until it expires (default 1 h); every protected operation re-checks
  // account state in the database, so suspension still applies immediately.
  await supabase.auth.signOut({ scope: "local" });
}
