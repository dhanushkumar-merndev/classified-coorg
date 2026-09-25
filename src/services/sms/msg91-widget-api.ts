import "server-only";

// MSG91 OTP widget REST API, called from our server so no MSG91 script has to
// load in the browser (ad blockers and Brave Shields block it). Usable only
// when captcha is off in the widget settings — with captcha on MSG91 answers
// "Invalid Captcha Token" and the browser widget must be used instead.
// Every call answers HTTP 200 with {type: "success" | "error", message}.

const BASE = "https://control.msg91.com/api/v5/widget";
const TIMEOUT_MS = 8_000;
const MODE_TTL_MS = 5 * 60_000;

type Answer = { type?: unknown; message?: unknown };

async function call(path: string, tokenAuth: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<Answer | null> {
  try {
    const response = await fetch(`${BASE}/${path}`, {
      method: init.method,
      headers: { tokenAuth, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 429 || response.status >= 500) return null;
    return (await response.json().catch(() => null)) as Answer | null;
  } catch {
    return null;
  }
}

let cachedMode: { serverSide: boolean; otpLength: number; retrySeconds: number; at: number } | null = null;

/** Reads the widget settings: server-side sending needs captcha off. Cached. */
export async function widgetMode(widgetId: string, tokenAuth: string) {
  if (cachedMode && Date.now() - cachedMode.at < MODE_TTL_MS) return cachedMode;
  const answer = await call(`getWidgetProcess?widgetId=${encodeURIComponent(widgetId)}`, tokenAuth, { method: "GET" });
  const data = (answer && typeof answer === "object" ? answer : {}) as Record<string, unknown>;
  const settings = (typeof data.message === "object" && data.message ? data.message : data.data ?? data) as Record<string, unknown>;
  const otpLength = Number(settings.otpLength);
  const retrySeconds = Number(settings.retryTime);
  const mode = {
    serverSide: answer !== null && Number(settings.captchaValidations ?? 1) === 0,
    otpLength: otpLength >= 4 && otpLength <= 8 ? otpLength : 6,
    retrySeconds: retrySeconds > 0 ? Math.min(retrySeconds, 300) : 30,
    at: Date.now(),
  };
  if (answer !== null) cachedMode = mode;
  return mode;
}

export type SendResult = { ok: true; reqId: string } | { ok: false; reason: "rejected" | "unavailable"; message: string };

export async function widgetSendOtp(widgetId: string, tokenAuth: string, identifier: string): Promise<SendResult> {
  const answer = await call("sendOtp", tokenAuth, { method: "POST", body: { widgetId, tokenAuth, identifier } });
  if (!answer) return { ok: false, reason: "unavailable", message: "unavailable" };
  if (answer.type === "success" && typeof answer.message === "string") return { ok: true, reqId: answer.message };
  return { ok: false, reason: "rejected", message: typeof answer.message === "string" ? answer.message.slice(0, 120) : "error" };
}

export type VerifyResult = { ok: true; accessToken: string } | { ok: false; reason: "rejected" | "unavailable" };

export async function widgetVerifyOtp(widgetId: string, tokenAuth: string, reqId: string, otp: string): Promise<VerifyResult> {
  const answer = await call("verifyOtp", tokenAuth, { method: "POST", body: { widgetId, tokenAuth, reqId, otp } });
  if (!answer) return { ok: false, reason: "unavailable" };
  if (answer.type === "success" && typeof answer.message === "string" && answer.message.startsWith("eyJ")) {
    return { ok: true, accessToken: answer.message };
  }
  return { ok: false, reason: "rejected" };
}
