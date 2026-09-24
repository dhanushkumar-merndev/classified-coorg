import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Bearer check for scheduled job endpoints (Vercel Cron sends CRON_SECRET). */
export function isAuthorizedJob(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
