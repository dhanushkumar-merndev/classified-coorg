import "server-only";
import { AppError } from "@/lib/errors";
import { isValidOtp, normalizePhone } from "@/lib/auth/phone";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSessionClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Phone OTP login (architecture §10–11, AUTH suite). Supabase Auth issues and
// verifies the code; MSG91 only delivers it via the Send SMS hook. Limits here
// protect the application path; the hook enforces per-phone limits for every
// path, including direct Auth API calls.

export const RESEND_COOLDOWN_SECONDS = 60;

export async function requestOtp(input: { phone: unknown; ip: string | null }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("INVALID_PHONE");
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

  return { redirectTo: safeNextPath(input.next) };
}

export async function signOut() {
  const supabase = await createSessionClient();
  // Revokes this device's refresh token. An already-issued access token stays
  // valid until it expires (default 1 h); every protected operation re-checks
  // account state in the database, so suspension still applies immediately.
  await supabase.auth.signOut({ scope: "local" });
}
