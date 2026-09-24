import type { NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, hasAnyRole, requireActor } from "@/lib/auth/dal";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notFoundResponse, streamObject } from "@/lib/storage/deliver";
import { tigrisStorage } from "@/lib/storage/tigris";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";

// Private verification document proxy (DOC-002/003/008/009). Authorization is
// re-evaluated on every request against current database state, so access
// ends immediately when a role, suspension or ownership changes; no bearer
// URL is ever issued. Unknown, foreign and removed documents all return the
// same 404 so existence is not disclosed.

export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/[documentId]">) {
  const { documentId } = await ctx.params;
  if (!z.uuid().safeParse(documentId).success) return notFoundResponse();

  let actor;
  try {
    actor = await requireActor();
    await enforceRateLimit("document_read", actor.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") {
      return new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(error.retryAfterSeconds ?? 60), "Cache-Control": "no-store" },
      });
    }
    return notFoundResponse();
  }

  // RLS: only the listing owner and admins can see the row.
  const supabase = await createSessionClient();
  const { data: doc } = await supabase
    .from("property_documents")
    .select("id, property_id, storage_bucket, storage_path, mime_type")
    .eq("id", documentId)
    .is("removed_at", null)
    .maybeSingle();
  if (!doc) return notFoundResponse();

  if (hasAnyRole(actor, ADMIN_ROLES)) {
    const { error } = await createServiceClient().from("audit_logs").insert({
      actor_id: actor.id,
      action: "document.read",
      entity_type: "property_document",
      entity_id: doc.id,
      metadata: { property_id: doc.property_id },
    });
    // Reviewer access must be auditable; refuse rather than serve unaudited.
    if (error) {
      logger.error("document.audit_failed", { code: error.code });
      return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  const extension = doc.mime_type === "application/pdf" ? "pdf" : "webp";
  try {
    return await streamObject(tigrisStorage, doc.storage_bucket, doc.storage_path, {
      "Content-Type": doc.mime_type,
      // Attachment + sandbox CSP: nothing in the file runs in the app origin.
      "Content-Disposition": `attachment; filename="document-${doc.id}.${extension}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    });
  } catch (error) {
    logger.error("document.stream_failed", { documentId: doc.id, error });
    return notFoundResponse();
  }
}
