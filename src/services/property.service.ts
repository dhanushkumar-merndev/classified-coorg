import "server-only";
import { z } from "zod";
import { LISTING_ROLES, requireActor } from "@/lib/auth/dal";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { createSessionClient } from "@/lib/supabase/server";
import {
  propertyDraftPatchSchema,
  transitionSchema,
  type PropertyDraftPatch,
} from "@/schemas/property.schema";

// Seller listing operations (property.createDraft / updateDraft / submit and
// the lifecycle actions). Every call runs with the user's own session, so RLS,
// column grants, the edit-lock trigger and transition_property() decide what
// is allowed; this layer validates input and maps errors.

function parsePatch(raw: unknown): PropertyDraftPatch {
  const parsed = propertyDraftPatchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", {
      detail: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))].join(","),
    });
  }
  return parsed.data;
}

export async function createDraft(raw: unknown) {
  await requireActor({ anyRole: LISTING_ROLES });
  const patch = parsePatch(raw ?? {});
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("properties").insert(patch).select("id, slug, version, status").single();
  if (error) throw fromDatabaseError(error);
  return data;
}

/** Optimistic concurrency (GAP-09): the write applies only if the row is still
 *  at `expectedVersion`; otherwise the caller gets a conflict, never a silent
 *  overwrite of newer data (e.g. from another tab's autosave). */
export async function updateDraft(propertyId: string, expectedVersion: number, raw: unknown) {
  await requireActor({ anyRole: LISTING_ROLES });
  if (!z.uuid().safeParse(propertyId).success) throw new AppError("PROPERTY_NOT_FOUND");
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new AppError("VALIDATION_FAILED", { detail: "version" });
  const patch = parsePatch(raw);
  if (Object.keys(patch).length === 0) throw new AppError("VALIDATION_FAILED", { detail: "empty_patch" });

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("properties")
    .update(patch)
    .eq("id", propertyId)
    .eq("version", expectedVersion)
    .select("id, version, slug, status")
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (data) return data;

  // Nothing updated: explain why without leaking other users' listings.
  const { data: current } = await supabase
    .from("properties")
    .select("version, status, deleted_at, owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  const actor = await requireActor();
  if (!current || current.owner_id !== actor.id || current.deleted_at) throw new AppError("PROPERTY_NOT_FOUND");
  if (current.status !== "draft" && current.status !== "changes_required") {
    throw new AppError("PROPERTY_NOT_EDITABLE", { detail: current.status });
  }
  throw new AppError("VERSION_CONFLICT", { detail: String(current.version) });
}

export async function transitionProperty(raw: unknown) {
  await requireActor();
  const parsed = transitionSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED");
  const input = parsed.data;

  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("transition_property", {
    p_property_id: input.propertyId,
    p_action: input.action,
    p_expected_version: input.expectedVersion,
    p_revision_id: input.revisionId ?? null,
    p_reason: input.reason ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_request_id: input.requestId ?? null,
  });
  if (error) throw fromDatabaseError(error);
  return data as { property_id: string; status: string; version: number; revision_id: string | null; replayed: boolean };
}
