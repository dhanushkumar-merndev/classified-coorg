import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/auth/dal";
import { notFoundResponse, streamObject } from "@/lib/storage/deliver";
import { tigrisStorage } from "@/lib/storage/tigris";
import { createSessionClient } from "@/lib/supabase/server";

// Private preview of listing photos for their owner and admins (drafts,
// listings under review). Never enters shared caches or the image optimizer.

const VARIANTS = { full: "storage_path", thumb: "thumbnail_path" } as const;

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/media/preview/[mediaId]/[variant]">) {
  const { mediaId, variant } = await ctx.params;
  if (!z.uuid().safeParse(mediaId).success || !(variant in VARIANTS)) return notFoundResponse();

  try {
    await requireActor();
  } catch {
    return notFoundResponse();
  }
  // RLS: owner of the listing, admins, or any viewer of a public listing.
  const supabase = await createSessionClient();
  const { data } = await supabase
    .from("property_media")
    .select("storage_bucket, storage_path, thumbnail_path")
    .eq("id", mediaId)
    .is("removed_at", null)
    .maybeSingle();
  if (!data) return notFoundResponse();

  try {
    return await streamObject(tigrisStorage, data.storage_bucket, data[VARIANTS[variant as keyof typeof VARIANTS]], {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
    });
  } catch {
    return notFoundResponse();
  }
}
