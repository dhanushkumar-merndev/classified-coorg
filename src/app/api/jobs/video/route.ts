import { after } from "next/server";
import { z } from "zod";
import { isAuthorizedJob } from "@/lib/jobs";
import { runVideoJob } from "@/services/video.service";

// Runs one video transcode job (video.service.ts). Called by the app itself
// with CRON_SECRET, one invocation per job, so each gets its own CPU and time
// budget. Answers at once and works after the response.
// Must be a literal; keep equal to VIDEO_TIMING.jobMaxDurationSeconds.
export const maxDuration = 300;

const bodySchema = z.object({ jobId: z.uuid() });

export async function POST(request: Request) {
  if (!isAuthorizedJob(request)) return new Response("Unauthorized", { status: 401 });
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid_job" }, { status: 400 });
  after(() => runVideoJob(body.data.jobId));
  return Response.json({ accepted: true }, { status: 202 });
}
