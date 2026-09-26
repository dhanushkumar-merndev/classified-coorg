import "server-only";
import { AppError, type ErrorCode } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

// Shared atomic limiter backed by app.rate_limits (no per-instance memory, no
// Redis). Policies live in app.rate_limit_policies.

export type RateLimitAction =
  | "otp_send_phone_cooldown"
  | "otp_send_phone_hourly"
  | "otp_send_phone_daily"
  | "otp_request_ip"
  | "otp_request_ip_daily"
  | "otp_request_fingerprint"
  | "otp_request_fingerprint_daily"
  | "otp_verify_phone"
  | "otp_verify_phone_daily"
  | "otp_verify_ip"
  | "document_read";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(action: RateLimitAction, subject: string): Promise<RateLimitDecision> {
  const { data, error } = await createServiceClient().rpc("consume_rate_limit", {
    p_action: action,
    p_subject: subject,
  });
  // Fail closed: if the limiter is unavailable, the guarded action is refused.
  if (error || !data) throw new AppError("DEPENDENCY_FAILED", { cause: error });
  const decision = data as { allowed: boolean; retry_after_seconds: number };
  return { allowed: decision.allowed, retryAfterSeconds: decision.retry_after_seconds };
}

export async function enforceRateLimit(
  action: RateLimitAction,
  subject: string,
  code: Extract<ErrorCode, "RATE_LIMITED" | "OTP_RATE_LIMITED"> = "RATE_LIMITED",
): Promise<void> {
  const decision = await consumeRateLimit(action, subject);
  if (!decision.allowed) throw new AppError(code, { retryAfterSeconds: decision.retryAfterSeconds });
}
