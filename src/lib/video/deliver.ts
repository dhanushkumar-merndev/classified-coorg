import "server-only";
import { z } from "zod";
import { VIDEO_TIMING } from "@/lib/config/uploads";
import { logger } from "@/lib/logger";
import { notFoundResponse, streamObject } from "@/lib/storage/deliver";
import { tigrisStorage } from "@/lib/storage/tigris";
import type { createPublicClient } from "@/lib/supabase/server";
import { buildMasterPlaylist, buildMediaPlaylist, groupTracks, type EncodeOutput } from "./playlist";

// Serves a listing video: /…/<videoId>/master.m3u8, /…/<videoId>/<720p|audio>/index.m3u8
// and /…/<videoId>/poster.jpg. Which videos a caller may read is decided by
// the database client passed in (RLS), exactly as for listing photos.
// Playlists are small and built per request; the segments themselves are
// fetched by the player straight from the private bucket through the signed
// URLs inside the media playlist, so video bytes never pass through here.

type Client = Pick<ReturnType<typeof createPublicClient>, "from">;

interface VideoRow {
  storage_bucket: string;
  hls_prefix: string;
  poster_path: string | null;
  state: string;
  outputs: EncodeOutput[];
}

const PLAYLIST_HEADERS = {
  "Content-Type": "application/vnd.apple.mpegurl",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function serveVideo(
  client: Client,
  videoId: string,
  path: string[],
  cache: { playlist: string; poster: string },
): Promise<Response> {
  const file = path.join("/");
  const media = /^((?:[0-9]{3,4}p)|audio)\/index\.m3u8$/.exec(file);
  if (!z.uuid().safeParse(videoId).success || !(file === "master.m3u8" || file === "poster.jpg" || media)) {
    return notFoundResponse();
  }

  const { data, error } = await client
    .from("property_videos")
    .select("storage_bucket, hls_prefix, poster_path, state, outputs")
    .eq("id", videoId)
    .is("removed_at", null)
    .maybeSingle();
  if (error) {
    logger.error("video.lookup_failed", { code: error.code });
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const video = data as VideoRow | null;
  if (!video) return notFoundResponse();

  if (file === "poster.jpg") {
    if (!video.poster_path) return notFoundResponse();
    try {
      return await streamObject(tigrisStorage, video.storage_bucket, video.poster_path, {
        "Content-Type": "image/jpeg",
        "Cache-Control": cache.poster,
        ETag: `"${videoId}-poster"`,
      });
    } catch {
      return notFoundResponse();
    }
  }

  if (video.state !== "ready") return notFoundResponse();
  if (file === "master.m3u8") {
    return new Response(buildMasterPlaylist(video.outputs), {
      headers: { ...PLAYLIST_HEADERS, "Cache-Control": cache.playlist },
    });
  }

  const { video: tracks, audio } = groupTracks(video.outputs);
  const track = media![1] === "audio" ? audio : tracks.find((t) => t.rendition === media![1]);
  if (!track) return notFoundResponse();
  const body = await buildMediaPlaylist(track, (p) =>
    tigrisStorage.presignGet(video.storage_bucket, `${video.hls_prefix}/${p}`, {
      expiresInSeconds: VIDEO_TIMING.segmentUrlTtlSeconds,
    }));
  return new Response(body, { headers: { ...PLAYLIST_HEADERS, "Cache-Control": cache.playlist } });
}
