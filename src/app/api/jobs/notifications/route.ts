import { isAuthorizedJob } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { deliverPendingNotifications } from "@/services/notification.service";

// Daily sweep (Vercel Hobby runs crons once a day). Intents are normally
// delivered straight after the action that queued them; this catches the rest.
export async function GET(request: Request) {
  if (!isAuthorizedJob(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const total = { claimed: 0, sent: 0, failed: 0 };
    // Drain in batches, bounded so one run stays well inside the function limit.
    for (let batch = 0; batch < 10; batch++) {
      const r = await deliverPendingNotifications(50);
      total.claimed += r.claimed; total.sent += r.sent; total.failed += r.failed;
      if (r.claimed < 50) break;
    }
    return Response.json(total);
  } catch (e) {
    logger.error("job.notifications.claim", { error: e });
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }
}
