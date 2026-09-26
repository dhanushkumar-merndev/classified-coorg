import { after, type NextRequest } from "next/server";
import { jsonResponse, runAction } from "@/lib/api/response";
import { LISTING_ROLES, requireActor } from "@/lib/auth/dal";
import { assertSameOrigin } from "@/lib/request/same-origin";
import { finalizeUpload } from "@/services/upload.service";
import { kickVideoJobs } from "@/services/video.service";

// media.finalizeUpload: validates the uploaded bytes and commits the file.
// Safe to retry; a finalized session returns the same id. A video is committed
// in `processing` and its transcode starts after the response.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/uploads/[sessionId]/finalize">) {
  const result = await runAction("uploads.finalize", async () => {
    assertSameOrigin(request);
    const actor = await requireActor({ anyRole: LISTING_ROLES });
    const { sessionId } = await ctx.params;
    const finalized = await finalizeUpload(actor, sessionId);
    if ("jobId" in finalized && finalized.jobId) {
      const jobId = finalized.jobId;
      after(() => kickVideoJobs([jobId]));
    }
    return finalized;
  });
  return jsonResponse(result);
}
