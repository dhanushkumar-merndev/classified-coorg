import { appEnv, hookEnv, smsEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { Msg91SmsProvider } from "@/services/sms/msg91";
import { handleSendSmsHook } from "@/services/sms/send-sms-hook";

// Supabase Auth → "Send SMS" HTTP hook. Configure in Supabase:
// Authentication → Hooks → Send SMS → HTTPS → <site>/api/auth/sms-hook,
// and put the generated secret in SEND_SMS_HOOK_SECRET.

const MAX_BODY_BYTES = 16 * 1024;
const SOURCE = "supabase_send_sms";

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return noStore({ error: { http_code: 413, message: "Payload too large" } }, 413);
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return noStore({ error: { http_code: 413, message: "Payload too large" } }, 413);

  let result;
  try {
    // Only the hook secret is needed to authenticate the call; MSG91 settings
    // are read at send time, so unsigned requests get 401 even before MSG91 is configured.
    const hook = hookEnv();
    const service = createServiceClient();
    result = await handleSendSmsHook(rawBody, Object.fromEntries(request.headers), {
      hookSecret: hook.SEND_SMS_HOOK_SECRET,
      appEnv: appEnv().APP_ENV,
      allowlist: hook.allowlist,
      sms: {
        sendOtp: (phone, otp) => {
          const sms = smsEnv();
          return new Msg91SmsProvider({
            authKey: sms.MSG91_AUTH_KEY,
            templateId: sms.MSG91_OTP_TEMPLATE_ID,
            otpVariable: sms.MSG91_OTP_VARIABLE,
          }).sendOtp(phone, otp);
        },
      },
      registerReceipt: async (id) => {
        const { data, error } = await service.rpc("register_webhook_receipt", { p_source: SOURCE, p_id: id });
        if (error) throw error;
        return data === true;
      },
      releaseReceipt: async (id) => {
        const { error } = await service.rpc("release_webhook_receipt", { p_source: SOURCE, p_id: id });
        if (error) logger.warn("sms_hook.release_failed", { error });
      },
      consume: consumeRateLimit,
      log: (event, fields) => logger.info(event, fields),
    });
  } catch (error) {
    logger.error("sms_hook.error", { error });
    return noStore({ error: { http_code: 500, message: "Hook unavailable" } }, 500);
  }
  return noStore(result.body, result.status);
}

function noStore(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
