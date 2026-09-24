import { jsonResponse, runAction } from "@/lib/api/response";
import { LISTING_ROLES, requireActor } from "@/lib/auth/dal";
import { assertSameOrigin, readJsonBody } from "@/lib/request/same-origin";
import { initiateUpload } from "@/services/upload.service";

// media.initiateUpload / document upload initiation.
export async function POST(request: Request) {
  const result = await runAction("uploads.initiate", async () => {
    assertSameOrigin(request);
    const actor = await requireActor({ anyRole: LISTING_ROLES });
    return initiateUpload(actor, await readJsonBody(request));
  });
  return jsonResponse(result, { status: 201 });
}
