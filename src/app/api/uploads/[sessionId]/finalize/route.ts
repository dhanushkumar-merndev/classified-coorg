import type { NextRequest } from "next/server";
import { jsonResponse, runAction } from "@/lib/api/response";
import { LISTING_ROLES, requireActor } from "@/lib/auth/dal";
import { assertSameOrigin } from "@/lib/request/same-origin";
import { finalizeUpload } from "@/services/upload.service";

// media.finalizeUpload: validates the uploaded bytes and commits the file.
// Safe to retry; a finalized session returns the same id.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/uploads/[sessionId]/finalize">) {
  const result = await runAction("uploads.finalize", async () => {
    assertSameOrigin(request);
    const actor = await requireActor({ anyRole: LISTING_ROLES });
    const { sessionId } = await ctx.params;
    return finalizeUpload(actor, sessionId);
  });
  return jsonResponse(result);
}
