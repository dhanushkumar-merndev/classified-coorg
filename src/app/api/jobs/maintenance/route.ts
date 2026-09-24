import { isAuthorizedJob } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { tigrisStorage } from "@/lib/storage/tigris";
import { createServiceClient } from "@/lib/supabase/server";

// Scheduled cleanup: expires stale upload sessions, deletes their quarantine
// objects, and trims rate-limit and webhook-receipt rows.
export async function GET(request: Request) {
  if (!isAuthorizedJob(request)) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await createServiceClient().rpc("run_maintenance", { p_batch: 500 });
  if (error) {
    logger.error("job.maintenance", { code: error.code });
    return Response.json({ error: "maintenance_failed" }, { status: 500 });
  }
  const result = data as { expired_uploads: Array<{ bucket: string; key: string }> };
  let deleted = 0;
  for (const o of result.expired_uploads) {
    try { await tigrisStorage.delete(o.bucket, o.key); deleted++; } catch (e) { logger.warn("job.maintenance.delete", { key: o.key, error: e }); }
  }
  return Response.json({ ...result, expired_uploads: result.expired_uploads.length, objects_deleted: deleted });
}
