import type { NextRequest } from "next/server";
import { z } from "zod";
import { PUBLIC_MEDIA_MAX_AGE_SECONDS } from "@/lib/config/uploads";
import { logger } from "@/lib/logger";
import { notFoundResponse, streamObject } from "@/lib/storage/deliver";
import { tigrisStorage } from "@/lib/storage/tigris";
import { createPublicClient } from "@/lib/supabase/server";

// Stable public URL for approved listing photos (STOR-008, MEDIA-008):
// /media/<mediaId>/full|thumb. Suitable for SSR, cards and Open Graph.
//
// Eligibility is decided by the database: the lookup uses the anonymous
// client, so RLS returns the row only while the parent listing passes the
// public predicate. Only media rows can be resolved, never documents or
// arbitrary keys. Media ids are immutable, so the URL is its own version.

const VARIANTS = { full: "storage_path", thumb: "thumbnail_path" } as const;

export async function GET(_request: NextRequest, ctx: RouteContext<"/media/[mediaId]/[variant]">) {
  const { mediaId, variant } = await ctx.params;
  if (!z.uuid().safeParse(mediaId).success || !(variant in VARIANTS)) return notFoundResponse();

  const { data, error } = await createPublicClient()
    .from("property_media")
    .select("storage_bucket, storage_path, thumbnail_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) {
    logger.error("media.lookup_failed", { code: error.code });
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!data) return notFoundResponse();

  try {
    return await streamObject(tigrisStorage, data.storage_bucket, data[VARIANTS[variant as keyof typeof VARIANTS]], {
      "Content-Type": "image/webp",
      // Shared caches may keep an approved photo for up to this long after the
      // listing is hidden (documented removal freshness, GAP-02/10).
      "Cache-Control": `public, max-age=${PUBLIC_MEDIA_MAX_AGE_SECONDS}, s-maxage=${PUBLIC_MEDIA_MAX_AGE_SECONDS}`,
      ETag: `"${mediaId}-${variant}"`,
    });
  } catch {
    return notFoundResponse();
  }
}
