import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/dal";
import { notFoundResponse } from "@/lib/storage/deliver";
import { createSessionClient } from "@/lib/supabase/server";
import { serveVideo } from "@/lib/video/deliver";

// Private preview of a listing video for its owner and admins (drafts,
// listings under review). Never enters shared caches.

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/media/preview/video/[videoId]/[...path]">) {
  try {
    await requireActor();
  } catch {
    return notFoundResponse();
  }
  const { videoId, path } = await ctx.params;
  return serveVideo(await createSessionClient(), videoId, path, { playlist: "private, no-store", poster: "private, no-store" });
}
