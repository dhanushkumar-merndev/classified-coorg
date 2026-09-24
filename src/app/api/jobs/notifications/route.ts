import { isAuthorizedJob } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/server";

// Delivers durable notification intents (written in the same transaction as
// the business event). Each becomes an in-app notification; email goes out via
// Brevo only when BREVO_API_KEY and BREVO_SENDER_EMAIL are configured.

interface Intent {
  id: string; event_type: string; recipient_id: string; entity_type: string; entity_id: string | null;
  payload: Record<string, unknown>;
}

const COPY: Record<string, { title: string; body: string }> = {
  welcome: { title: "Welcome to Land in Coorg", body: "Your account is ready." },
  listing_submitted: { title: "Listing submitted", body: "We'll review it shortly." },
  listing_approved: { title: "Your listing is live", body: "It has been verified and published." },
  listing_rejected: { title: "Listing not approved", body: "Open the listing to see the reviewer's message." },
  changes_requested: { title: "Changes requested", body: "Update your listing and resubmit." },
  new_enquiry: { title: "New enquiry", body: "A buyer contacted you about your listing." },
  listing_expiry: { title: "Listing expiring soon", body: "Renew to keep it visible." },
  security_notice: { title: "Security notice", body: "There was a change to your account." },
};

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!key || !sender) return false;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: sender, name: process.env.BREVO_SENDER_NAME ?? "Land in Coorg" }, to: [{ email: to }], subject, textContent: text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`brevo_${res.status}`);
  return true;
}

export async function GET(request: Request) {
  if (!isAuthorizedJob(request)) return new Response("Unauthorized", { status: 401 });
  const db = createServiceClient();
  const { data, error } = await db.rpc("claim_notification_intents", { p_limit: 50, p_lease_seconds: 120 });
  if (error) { logger.error("job.notifications.claim", { code: error.code }); return Response.json({ error: "claim_failed" }, { status: 500 }); }

  let sent = 0, failed = 0;
  for (const intent of (data ?? []) as Intent[]) {
    const copy = COPY[intent.event_type] ?? { title: "Notification", body: "" };
    try {
      const { error: insertError } = await db.from("notifications").insert({
        user_id: intent.recipient_id, type: intent.event_type, channel: "in_app", title: copy.title, body: copy.body,
      });
      if (insertError) throw new Error(insertError.code ?? "insert_failed");
      const { data: profile } = await db.from("profiles").select("email").eq("id", intent.recipient_id).maybeSingle();
      const { data: auth } = await db.auth.admin.getUserById(intent.recipient_id);
      const to = profile?.email && auth.user?.email_confirmed_at ? profile.email : null;
      if (to) await sendEmail(to, copy.title, copy.body);
      await db.rpc("complete_notification_intent", { p_id: intent.id, p_outcome: "sent" });
      sent++;
    } catch (e) {
      failed++;
      await db.rpc("complete_notification_intent", { p_id: intent.id, p_outcome: "failed", p_error: String((e as Error).message).slice(0, 200) });
    }
  }
  return Response.json({ claimed: (data ?? []).length, sent, failed });
}
