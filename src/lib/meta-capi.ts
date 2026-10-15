import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { metaEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { PixelEvent } from "@/lib/meta-pixel";
import { clientIp } from "@/lib/request/client-ip";
import { siteUrl } from "@/lib/site";

// Meta Conversions API: the server copy of a pixel funnel event. It carries the
// same event ID the browser pixel sends, so Meta counts the event once and
// still gets it when the pixel is blocked. Fire-and-forget: the request runs
// after the response, and failures are logged, never surfaced to the user.

const GRAPH_VERSION = "v26.0";
const TIMEOUT_MS = 5000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export interface MetaEventInput {
  event: PixelEvent;
  eventId: string;
  /** Unix seconds. */
  eventTime: number;
  sourceUrl: string;
  userAgent?: string | null;
  ip?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  phone?: string | null;
  userId?: string | null;
  params?: Record<string, unknown>;
}

/** One CAPI event. Phone (digits only, country code included) and user ID are
 *  SHA-256 hashed; browser identifiers (IP, user agent, _fbp/_fbc) go as-is,
 *  as Meta requires. Absent fields are left out rather than sent empty. */
export function buildMetaEvent(input: MetaEventInput) {
  const digits = input.phone?.replace(/\D/g, "");
  const userData = Object.fromEntries(
    Object.entries({
      client_user_agent: input.userAgent,
      client_ip_address: input.ip,
      fbp: input.fbp,
      fbc: input.fbc,
      ph: digits ? sha256(digits) : null,
      external_id: input.userId ? sha256(input.userId) : null,
    }).filter(([, value]) => value),
  );
  return {
    event_name: input.event,
    event_id: input.eventId,
    event_time: input.eventTime,
    action_source: "website" as const,
    event_source_url: input.sourceUrl,
    user_data: userData,
    ...(input.params && Object.keys(input.params).length > 0 ? { custom_data: input.params } : {}),
  };
}

/** Reports a funnel event from a Server Action that has just succeeded and
 *  returns its event ID for the browser pixel. Always returns an ID; sends
 *  nothing when the CAPI token is not configured. */
export function sendMetaEvent(
  event: PixelEvent,
  user: { userId?: string | null; phone?: string | null },
  params?: Record<string, unknown>,
): string {
  const eventId = randomUUID();
  const env = metaEnv();
  if (!env.enabled) return eventId;
  const eventTime = Math.floor(Date.now() / 1000);

  after(async () => {
    try {
      const [h, c] = await Promise.all([headers(), cookies()]);
      const payload = buildMetaEvent({
        event, eventId, eventTime, params, ...user,
        // A Server Action posts to the page it runs on, so Referer is that page.
        sourceUrl: h.get("referer") ?? siteUrl("/"),
        userAgent: h.get("user-agent"),
        ip: clientIp(h),
        fbp: c.get("_fbp")?.value,
        fbc: c.get("_fbc")?.value,
      });
      const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [payload],
          access_token: env.accessToken,
          ...(env.testEventCode ? { test_event_code: env.testEventCode } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        logger.warn("meta.capi_failed", { event, status: response.status, message: body?.error?.message });
      }
    } catch (error) {
      logger.warn("meta.capi_failed", { event, cause: error });
    }
  });

  return eventId;
}
