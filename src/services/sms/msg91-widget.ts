import { normalizePhone } from "@/lib/auth/phone";

// MSG91 OTP widget, server side. The browser sends and verifies the code with
// MSG91 and receives a JWT access token; the server re-checks that token with
// MSG91 (authkey stays server-only) and takes the verified phone from MSG91's
// answer — never from the browser — before any session is created.
//
// verifyAccessToken answers HTTP 200 for both outcomes:
//   {"type":"success","message":"<identifier or text>"}
//   {"type":"error","message":"AuthenticationFailure","code":"201"}

const VERIFY_ENDPOINT = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
const TIMEOUT_MS = 8_000;
const MAX_TOKEN_LENGTH = 4_096;

export type WidgetVerification =
  | { ok: true; phones: string[]; diagnostics: { messageKind: string; claimKeys: string[] } }
  | { ok: false; reason: "malformed" | "rejected" | "unavailable"; answer?: string };

// JWT segments are normally base64url; tolerate standard base64 and padding.
export function looksLikeAccessToken(token: unknown): token is string {
  return typeof token === "string" && token.length <= MAX_TOKEN_LENGTH && /^[\w+/=-]+\.[\w+/=-]+\.[\w+/=-]+$/.test(token);
}

/** Safe description of a token for logs: shape only, never content. */
export function tokenShape(token: unknown): string {
  if (typeof token !== "string") return typeof token;
  const parts = token.split(".");
  return `len=${token.length} segments=${parts.length} sizes=${parts.map((p) => p.length).join("/")} std64=${/[+/=]/.test(token)}`;
}

export async function verifyWidgetAccessToken(
  token: string,
  config: { authKey: string; fetchImpl?: typeof fetch },
): Promise<WidgetVerification> {
  if (!looksLikeAccessToken(token)) return { ok: false, reason: "malformed" };
  const fetchImpl = config.fetchImpl ?? fetch;

  type VerifyBody = { type?: unknown; message?: unknown } | null;
  let body: VerifyBody = null;
  try {
    const response = await fetchImpl(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ authkey: config.authKey, "access-token": token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 429 || response.status >= 500) return { ok: false, reason: "unavailable" };
    body = (await response.json().catch(() => null)) as VerifyBody;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!body || body.type !== "success") {
    return { ok: false, reason: "rejected", answer: typeof body?.message === "string" ? body.message.slice(0, 80) : typeof body?.message };
  }

  // The token is authentic once MSG91 accepts it, so its claims can be read.
  const claims = decodeJwtPayload(token);
  const candidates = [...collectStrings(body.message), ...collectStrings(claims)];
  const phones = [...new Set(candidates.flatMap(phonesIn))];
  return {
    ok: true,
    phones,
    diagnostics: {
      messageKind: typeof body.message === "string" ? (phonesIn(body.message).length ? "phone" : "text") : typeof body.message,
      claimKeys: keyPaths(claims).slice(0, 30),
    },
  };
}

/** Indian mobile numbers found in a string ("919876543210", "+919876543210",
 *  "9876543210", or embedded in longer text), as E.164. */
function phonesIn(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(/\+?\d{10,13}/g)) {
    const v = m[0];
    const phone = normalizePhone(v.startsWith("+") || v.length === 10 ? v : `+${v}`);
    if (phone) out.push(phone);
  }
  return out;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1]!;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const value: unknown = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** String and integer values anywhere in a small JSON value (depth ≤ 6). */
function collectStrings(value: unknown, depth = 0): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number" && Number.isSafeInteger(value)) return [String(value)];
  if (depth >= 6 || !value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap((v) => collectStrings(v, depth + 1));
}

/** Key paths of a JSON object for diagnostics (no values). */
function keyPaths(value: unknown, prefix = "", depth = 0): string[] {
  if (!value || typeof value !== "object" || depth >= 3) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return [path, ...keyPaths(v, path, depth + 1)];
  });
}
