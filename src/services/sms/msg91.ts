import { SmsSendError, type SmsProvider } from "./sms-provider";

// MSG91 Flow API (v5) delivering a Supabase-issued OTP through a DLT-approved
// template. MSG91 only delivers; Supabase remains the sole verifier (SMS-001).
// Contract to confirm against the live account before launch (SMS-003):
// endpoint, `authkey` header, recipients[].mobiles without "+", the template
// variable name, and the {type: "success" | "error", message} response body.

const FLOW_ENDPOINT = "https://control.msg91.com/api/v5/flow";
const TIMEOUT_MS = 8_000;

interface Msg91Response {
  type?: unknown;
  message?: unknown;
}

export interface Msg91Config {
  authKey: string;
  templateId: string;
  otpVariable: string;
  fetchImpl?: typeof fetch;
}

export class Msg91SmsProvider implements SmsProvider {
  constructor(private readonly config: Msg91Config) {}

  async sendOtp(phoneE164: string, otp: string): Promise<{ providerMessageId: string | null }> {
    const fetchImpl = this.config.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(FLOW_ENDPOINT, {
        method: "POST",
        headers: {
          authkey: this.config.authKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          template_id: this.config.templateId,
          short_url: "0",
          recipients: [{ mobiles: phoneE164.replace(/^\+/, ""), [this.config.otpVariable]: otp }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      // Timeout or connection loss: the provider may or may not have accepted it.
      throw new SmsSendError("ambiguous", null, `request failed: ${(error as Error).name}`);
    }

    let body: Msg91Response | null;
    try {
      body = (await response.json()) as Msg91Response | null;
    } catch {
      body = null;
    }

    if (response.status === 429 || response.status >= 500) {
      throw new SmsSendError("transient", response.status, "provider unavailable or throttled");
    }
    if (!response.ok) {
      throw new SmsSendError("permanent", response.status, "provider rejected request");
    }
    if (!body || typeof body.type !== "string") {
      throw new SmsSendError("ambiguous", response.status, "unreadable provider response");
    }
    // MSG91 reports some failures as HTTP 200 with type "error".
    if (body.type !== "success") {
      throw new SmsSendError("permanent", response.status, "provider returned an error result");
    }
    return { providerMessageId: typeof body.message === "string" ? body.message.slice(0, 100) : null };
  }
}
