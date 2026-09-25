"use client";

// MSG91 OTP widget in "exposeMethods" mode: MSG91's script supplies
// window.sendOtp / verifyOtp / retryOtp and our own form stays the UI. The
// access token it returns is only a claim — the server re-verifies it.

type WidgetResponse = { type?: string; message?: unknown; invisibleVerified?: boolean; "access-token"?: string } | undefined;
type Callback = (data: WidgetResponse) => void;

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, ok?: Callback, fail?: Callback) => void;
    verifyOtp?: (otp: string, ok?: Callback, fail?: Callback, reqId?: string | null) => void;
    retryOtp?: (channel: string | null, ok?: Callback, fail?: Callback, reqId?: string | null) => void;
    getWidgetData?: () => { retryTime?: number | string } | undefined;
    TraceIQ?: { track: (...args: unknown[]) => void };
  }
}

export const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const TOKEN_AUTH = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH ?? "";
const SCRIPTS = ["https://verify.msg91.com/otp-provider.js", "https://verify.phone91.com/otp-provider.js"];
const READY_TIMEOUT_MS = 15_000;
/** A widget call that never answers (e.g. captcha blocked) must not hang the form. */
const CALL_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new WidgetError("OTP service did not respond.")), CALL_TIMEOUT_MS);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export class WidgetError extends Error {}

let loading: Promise<void> | null = null;

export function loadMsg91Widget(): Promise<void> {
  if (!WIDGET_ID || !TOKEN_AUTH) return Promise.reject(new WidgetError("OTP widget is not configured."));
  if (typeof window.sendOtp === "function") return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    // The widget calls an analytics global after verification; its script is
    // not allowed by our CSP, so give it a no-op instead of a ReferenceError.
    window.TraceIQ ??= { track: () => {} };
    let index = 0;
    const attempt = () => {
      const script = document.createElement("script");
      script.src = SCRIPTS[index]!;
      script.async = true;
      script.onload = () => {
        window.initSendOTP?.({ widgetId: WIDGET_ID, tokenAuth: TOKEN_AUTH, exposeMethods: true, success: () => {}, failure: () => {} });
        const started = Date.now();
        const poll = () => {
          if (typeof window.sendOtp === "function") resolve();
          else if (Date.now() - started > READY_TIMEOUT_MS) reject(new WidgetError("OTP service did not load."));
          else setTimeout(poll, 100);
        };
        poll();
      };
      script.onerror = () => {
        index += 1;
        if (index < SCRIPTS.length) attempt();
        else reject(new WidgetError("OTP service could not be reached."));
      };
      document.head.appendChild(script);
    };
    attempt();
  });
  loading.catch(() => { loading = null; });
  return loading;
}

function messageOf(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const m = (data as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Unknown error";
}

/** Sends the code. Resolves with MSG91's request id, or with an access token
 *  when MSG91 verified the number invisibly (no code needed). */
export async function widgetSend(identifier: string): Promise<{ reqId: string | null; accessToken: string | null }> {
  await loadMsg91Widget();
  return withTimeout(new Promise((resolve, reject) => {
    window.sendOtp!(identifier, (d) => {
      if (d?.invisibleVerified && typeof d["access-token"] === "string") resolve({ reqId: null, accessToken: d["access-token"] });
      else resolve({ reqId: typeof d?.message === "string" ? d.message : null, accessToken: null });
    }, (e) => reject(new WidgetError(messageOf(e))));
  }));
}

/** Checks the code with MSG91 and resolves with its JWT access token. */
export async function widgetVerify(otp: string, reqId: string | null): Promise<string> {
  await loadMsg91Widget();
  return withTimeout(new Promise((resolve, reject) => {
    window.verifyOtp!(otp, (d) => {
      if (typeof d?.message === "string" && d.message.startsWith("eyJ")) resolve(d.message);
      else reject(new WidgetError(messageOf(d)));
    }, (e) => reject(new WidgetError(messageOf(e))), reqId);
  }));
}

export async function widgetRetry(reqId: string | null): Promise<void> {
  await loadMsg91Widget();
  return withTimeout(new Promise<void>((resolve, reject) => {
    window.retryOtp!(null, () => resolve(), (e) => reject(new WidgetError(messageOf(e))), reqId);
  }));
}

/** Seconds MSG91 enforces between resends (widget setting), default 30. */
export function widgetRetrySeconds(): number {
  const value = Number(window.getWidgetData?.()?.retryTime);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 300) : 30;
}
