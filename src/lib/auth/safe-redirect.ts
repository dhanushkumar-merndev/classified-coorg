// Post-login return path (AUTH-007): same-origin paths only. Rejects absolute
// and protocol-relative URLs, backslash tricks, control characters and
// oversized values; anything doubtful falls back.

const BASE = "http://internal.invalid";
const BLOCKED_PREFIXES = ["/login", "/api/"];

export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (BLOCKED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) {
    return fallback;
  }
  return path;
}
