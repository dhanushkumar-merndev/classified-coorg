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
/** Why MSG91 gave no usable answer: "throttled" is its own rate limit (429),
 *  the rest are outages. Kept for logs so a failed login can be traced. */
type Failure = { failure: "throttled" | "http_error" | "timeout" | "network" | "bad_json"; status?: number };

async function call(path: string, tokenAuth: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<Answer | Failure> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      method: init.method,
      headers: { tokenAuth, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return { failure: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
  }
  if (response.status === 429) return { failure: "throttled", status: 429 };
  if (response.status >= 500) return { failure: "http_error", status: response.status };
  const answer = (await response.json().catch(() => null)) as Answer | null;
  return answer && typeof answer === "object" ? answer : { failure: "bad_json", status: response.status };
}

function failed(answer: Answer | Failure): answer is Failure {
  return "failure" in answer;
}

// MSG91 answers HTTP 200 with type=error when it refuses for its own limits
// (resend count, verify attempts); those are rate limits, not wrong codes.
const LIMIT_MESSAGE = /limit|many|exceed|max/i;

let cachedMode: { serverSide: boolean; otpLength: number; retrySeconds: number; at: number } | null = null;

/** Reads the widget settings: server-side sending needs captcha off. Cached. */
export async function widgetMode(widgetId: string, tokenAuth: string) {
  if (cachedMode && Date.now() - cachedMode.at < MODE_TTL_MS) return cachedMode;
  const answer = await call(`getWidgetProcess?widgetId=${encodeURIComponent(widgetId)}`, tokenAuth, { method: "GET" });
  const reachable = !failed(answer);
  const data = (reachable ? answer : {}) as Record<string, unknown>;
  const settings = (typeof data.message === "object" && data.message ? data.message : data.data ?? data) as Record<string, unknown>;
  const otpLength = Number(settings.otpLength);
  const retrySeconds = Number(settings.retryTime);
  const mode = {
    serverSide: reachable && Number(settings.captchaValidations ?? 1) === 0,
    otpLength: otpLength >= 4 && otpLength <= 8 ? otpLength : 6,
    retrySeconds: retrySeconds > 0 ? Math.min(retrySeconds, 300) : 30,
    at: Date.now(),
  };
  if (reachable) cachedMode = mode;
  return mode;
}

export type SendResult =
  | { ok: true; reqId: string }
  | { ok: false; reason: "rejected" | "throttled" | "unavailable"; message: string };

export async function widgetSendOtp(widgetId: string, tokenAuth: string, identifier: string): Promise<SendResult> {
  const answer = await call("sendOtp", tokenAuth, { method: "POST", body: { widgetId, tokenAuth, identifier } });
  if (failed(answer)) return { ok: false, reason: answer.failure === "throttled" ? "throttled" : "unavailable", message: describe(answer) };
  if (answer.type === "success" && typeof answer.message === "string") return { ok: true, reqId: answer.message };
  const message = typeof answer.message === "string" ? answer.message.slice(0, 120) : "error";
  return { ok: false, reason: LIMIT_MESSAGE.test(message) ? "throttled" : "rejected", message };
}

export type VerifyResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "rejected" | "throttled" | "unavailable"; message: string };

export async function widgetVerifyOtp(widgetId: string, tokenAuth: string, reqId: string, otp: string): Promise<VerifyResult> {
  const answer = await call("verifyOtp", tokenAuth, { method: "POST", body: { widgetId, tokenAuth, reqId, otp } });
  if (failed(answer)) return { ok: false, reason: answer.failure === "throttled" ? "throttled" : "unavailable", message: describe(answer) };
  if (answer.type === "success" && typeof answer.message === "string" && answer.message.startsWith("eyJ")) {
    return { ok: true, accessToken: answer.message };
  }
  const message = typeof answer.message === "string" ? answer.message.slice(0, 120) : "error";
  return { ok: false, reason: LIMIT_MESSAGE.test(message) ? "throttled" : "rejected", message };
}

function describe(failure: Failure): string {
  return failure.status ? `${failure.failure} ${failure.status}` : failure.failure;
}
