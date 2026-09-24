import { Webhook } from "standardwebhooks";
import { z } from "zod";
import { maskPhone, normalizeAuthPhone } from "@/lib/auth/phone";
import { SmsSendError, type SmsProvider } from "./sms-provider";

// Supabase Auth "Send SMS" HTTP hook (SMS-001/002/004/006/007).
//
// This is the authoritative abuse guard for OTP delivery: anyone holding the
// public Supabase key can call Auth directly and skip Next.js, but every OTP
// Supabase issues passes through this hook. Per-phone limits therefore live
// here, not only in the login server action.

const payloadSchema = z.object({
  user: z.object({ phone: z.string().min(6).max(20) }),
  sms: z.object({ otp: z.string().regex(/^\d{4,10}$/) }),
});

export interface SendSmsHookDeps {
  hookSecret: string;
  appEnv: "local" | "staging" | "production";
  /** Non-production: only these E.164 numbers may receive SMS. */
  allowlist: ReadonlySet<string>;
  sms: SmsProvider;
  /** Returns true the first time a webhook id is seen. */
  registerReceipt(webhookId: string): Promise<boolean>;
  /** Forgets a receipt so a provider retry of a definitely-unsent event works. */
  releaseReceipt(webhookId: string): Promise<void>;
  consume(action: "otp_send_phone_cooldown" | "otp_send_phone_hourly" | "otp_send_phone_daily", subject: string):
    Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  log(event: string, fields: Record<string, unknown>): void;
}

export interface HookResponse {
  status: number;
  body: Record<string, unknown>;
}

/** Supabase hook error shape: {error: {http_code, message}}. */
function hookError(status: number, message: string): HookResponse {
  return { status, body: { error: { http_code: status, message } } };
}

export async function handleSendSmsHook(
  rawBody: string,
  headers: Record<string, string>,
  deps: SendSmsHookDeps,
): Promise<HookResponse> {
  // 1. Authenticate: Standard Webhooks signature + timestamp tolerance.
  let verified: unknown;
  try {
    verified = new Webhook(deps.hookSecret.replace(/^v1,whsec_/, "")).verify(rawBody, headers);
  } catch {
    return hookError(401, "Invalid hook signature");
  }
  const parsed = payloadSchema.safeParse(verified);
  if (!parsed.success) return hookError(400, "Invalid hook payload");
  const webhookId = headers["webhook-id"];
  if (!webhookId || webhookId.length > 200) return hookError(400, "Missing webhook id");

  const phone = normalizeAuthPhone(parsed.data.user.phone);
  if (!phone) return hookError(400, "Unsupported phone number");
  const masked = maskPhone(phone);

  // 2. Environment isolation (SMS-006): never text real users from non-production.
  if (deps.appEnv !== "production" && !deps.allowlist.has(phone)) {
    deps.log("sms_hook.blocked_non_allowlisted", { phone: masked, env: deps.appEnv });
    return hookError(403, "SMS is disabled for this number in this environment");
  }

  // 3. Replay guard (SMS-002): the same signed event never sends twice.
  if (!(await deps.registerReceipt(webhookId))) {
    deps.log("sms_hook.replay_ignored", { phone: masked });
    return { status: 200, body: {} };
  }

  // 4. Per-phone limits, cheapest-to-hit first; stop at the first denial so a
  //    blocked resend does not also burn the hourly/daily budget.
  for (const action of ["otp_send_phone_cooldown", "otp_send_phone_hourly", "otp_send_phone_daily"] as const) {
    const decision = await deps.consume(action, phone);
    if (!decision.allowed) {
      await deps.releaseReceipt(webhookId);
      deps.log("sms_hook.rate_limited", { phone: masked, action, retryAfterSeconds: decision.retryAfterSeconds });
      return hookError(429, `Too many codes requested. Try again in ${decision.retryAfterSeconds} seconds.`);
    }
  }

  // 5. Deliver. No automatic retry: a resend is a new, rate-limited request.
  try {
    const { providerMessageId } = await deps.sms.sendOtp(phone, parsed.data.sms.otp);
    deps.log("sms_hook.sent", { phone: masked, providerMessageId });
    return { status: 200, body: {} };
  } catch (error) {
    const kind = error instanceof SmsSendError ? error.kind : "ambiguous";
    const providerStatus = error instanceof SmsSendError ? error.providerStatus : null;
    // Definitely unsent: allow a genuine hook retry. Ambiguous: keep the
    // receipt so a retry of this event cannot double-send (SMS-004).
    if (kind !== "ambiguous") await deps.releaseReceipt(webhookId);
    deps.log("sms_hook.failed", { phone: masked, kind, providerStatus });
    return hookError(502, "Could not send the verification code");
  }
}
