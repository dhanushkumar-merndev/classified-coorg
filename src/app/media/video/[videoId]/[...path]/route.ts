import type { NextRequest } from "next/server";
import { PUBLIC_IMMUTABLE_MEDIA_CACHE, PUBLIC_MEDIA_MAX_AGE_SECONDS } from "@/lib/config/uploads";
import { createPublicClient } from "@/lib/supabase/server";
import { serveVideo } from "@/lib/video/deliver";

// Public video tour of an approved listing: /media/video/<videoId>/master.m3u8
// (plus the playlists and poster it references). The anonymous client means
// RLS returns the video only while its listing passes the public predicate.
// Shared caches keep a playlist at most as long as a photo (removal
// freshness); the signed segment URLs inside it stay valid far longer.

export async function GET(_request: NextRequest, ctx: RouteContext<"/media/video/[videoId]/[...path]">) {
  const { videoId, path } = await ctx.params;
  const shared = `public, max-age=60, s-maxage=${PUBLIC_MEDIA_MAX_AGE_SECONDS}`;
  return serveVideo(createPublicClient(), videoId, path, {
    playlist: shared,
    poster: PUBLIC_IMMUTABLE_MEDIA_CACHE,
  });
}
