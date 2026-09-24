// Client IP for rate limiting (GAP-17). Forwarding headers are only trusted
// where a known proxy sets them: on Vercel, `x-vercel-forwarded-for` /
// `x-real-ip` are written by the platform. Elsewhere they are client-supplied
// and could be spoofed to escape per-IP limits, so null is returned and callers
// skip only the per-IP limit (per-phone/per-user limits still apply). A shared
// fallback bucket would turn the per-IP limit into a site-wide lockout.

export function clientIp(headers: Headers): string | null {
  if (process.env.VERCEL !== "1") return null;
  const ip =
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && ip.length <= 64 ? ip : null;
}
