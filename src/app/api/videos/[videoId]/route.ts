import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonResponse, runAction } from "@/lib/api/response";
import { requireActor } from "@/lib/auth/dal";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createSessionClient } from "@/lib/supabase/server";
import { resumeStalledVideoJobs } from "@/services/video.service";

// Processing status for the listing editor, which polls while a video is
// being transcoded. RLS limits it to the owner and admins. While it polls,
// any job that never started or whose worker died is started again.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/videos/[videoId]">) {
  const result = await runAction("video.status", async () => {
    await requireActor();
    const { videoId } = await ctx.params;
    if (!z.uuid().safeParse(videoId).success) throw new AppError("MEDIA_NOT_FOUND");
    const supabase = await createSessionClient();
    const { data, error } = await supabase
      .from("property_videos")
      .select("id, state, error_code")
      .eq("id", videoId)
      .is("removed_at", null)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new AppError("MEDIA_NOT_FOUND");
    if (data.state === "processing") {
      after(() => resumeStalledVideoJobs(videoId).catch((e: unknown) => logger.warn("video.resume_failed", { videoId, error: e })));
    }
    return { id: data.id as string, state: data.state as "processing" | "ready" | "failed", errorCode: data.error_code as string | null };
  });
  return jsonResponse(result);
}
