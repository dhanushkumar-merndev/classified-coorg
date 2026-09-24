import { AppError } from "@/lib/errors";

// CSRF defence for cookie-authenticated Route Handlers (architecture §36).
// Server Actions get this check from Next.js; Route Handlers do not. Mirrors
// Next's rule: the Origin host must equal the Host / X-Forwarded-Host.

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) throw new AppError("FORBIDDEN", { detail: "origin_required" });
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", { detail: "origin_invalid" });
  }
  if (originHost !== host.split(",")[0].trim()) throw new AppError("FORBIDDEN", { detail: "origin_mismatch" });
}

/** Reads a JSON body with a hard byte ceiling (API request ceilings, GAP-21). */
export async function readJsonBody(request: Request, maxBytes = 8 * 1024): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError("VALIDATION_FAILED", { detail: "body_too_large" });
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("VALIDATION_FAILED", { detail: "body_too_large" });
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_FAILED", { detail: "invalid_json" });
  }
}
