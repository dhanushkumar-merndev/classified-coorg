"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/api/response";
import { LISTING_ROLES, requireActor } from "@/lib/auth/dal";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { FEATURE_OPTIONS } from "@/lib/labels";
import { createSessionClient } from "@/lib/supabase/server";
import { createDraft, transitionProperty, updateDraft } from "@/services/property.service";
import { CACHE_TAGS } from "@/repositories/public-listings";
import { PROPERTY_TYPES } from "@/schemas/property.schema";

// Seller listing actions (property.createDraft/updateDraft/submit/markSold/
// archive/delete, media.reorder/setCover/remove, document.remove). Run with
// the seller's session: RLS, the edit-lock trigger and transition_property()
// decide; public caches are invalidated whenever visibility can change.

function invalidatePublic(propertyId: string) {
  revalidateTag(CACHE_TAGS.listings, { expire: 0 });
  revalidateTag(CACHE_TAGS.listing(propertyId), { expire: 0 });
}

export async function createDraftAction(input: { propertyType: string }) {
  return runAction("property.createDraft", async () => {
    if (!(PROPERTY_TYPES as readonly string[]).includes(input.propertyType)) throw new AppError("VALIDATION_FAILED", { detail: "property_type" });
    const draft = await createDraft({ property_type: input.propertyType, listing_type: "sale" });
    revalidatePath("/dashboard/properties");
    return draft;
  });
}

export async function saveDraftAction(input: { propertyId: string; expectedVersion: number; patch: Record<string, unknown> }) {
  return runAction("property.updateDraft", async () => {
    const row = await updateDraft(input.propertyId, input.expectedVersion, input.patch);
    return { version: row.version, slug: row.slug };
  });
}

const transitionInput = z.strictObject({
  propertyId: z.uuid(),
  action: z.enum(["submit", "mark_sold", "archive"]),
  expectedVersion: z.int().positive(),
  requestId: z.uuid(),
});

export async function ownerTransitionAction(input: unknown) {
  return runAction("property.transition", async () => {
    const parsed = transitionInput.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED");
    const result = await transitionProperty(parsed.data);
    invalidatePublic(parsed.data.propertyId);
    revalidatePath("/dashboard/properties", "layout");
    return result;
  });
}

export async function deleteDraftAction(input: { propertyId: string; expectedVersion: number }) {
  return runAction("property.delete", async () => {
    await requireActor({ anyRole: LISTING_ROLES });
    const supabase = await createSessionClient();
    const { error } = await supabase.rpc("delete_property_draft", { p_property_id: input.propertyId, p_expected_version: input.expectedVersion });
    if (error) throw fromDatabaseError(error);
    revalidatePath("/dashboard/properties");
    return { deleted: true };
  });
}

export async function arrangeMediaAction(input: { propertyId: string; orderedIds: string[]; coverId: string }) {
  return runAction("media.reorder", async () => {
    await requireActor({ anyRole: LISTING_ROLES });
    const supabase = await createSessionClient();
    const { error } = await supabase.rpc("arrange_property_media", {
      p_property_id: input.propertyId, p_ordered_ids: input.orderedIds, p_cover_id: input.coverId,
    });
    if (error) throw fromDatabaseError(error);
    return { ok: true };
  });
}

export async function removeMediaAction(input: { mediaId: string }) {
  return runAction("media.remove", async () => {
    await requireActor({ anyRole: LISTING_ROLES });
    const supabase = await createSessionClient();
    const { error } = await supabase.rpc("remove_property_media", { p_media_id: input.mediaId });
    if (error) throw fromDatabaseError(error);
    return { ok: true };
  });
}

export async function removeDocumentAction(input: { documentId: string }) {
  return runAction("document.remove", async () => {
    await requireActor({ anyRole: LISTING_ROLES });
    const supabase = await createSessionClient();
    const { error } = await supabase.rpc("remove_property_document", { p_document_id: input.documentId });
    if (error) throw fromDatabaseError(error);
    return { ok: true };
  });
}

const featureKeys = new Set(FEATURE_OPTIONS.map((f) => f.key));
const featuresInput = z.strictObject({
  propertyId: z.uuid(),
  features: z.record(z.string(), z.string().trim().max(200).nullable()),
});

/** Replaces the listing's features with the given allowlisted key/value map. */
export async function saveFeaturesAction(input: unknown) {
  return runAction("property.features", async () => {
    const parsed = featuresInput.safeParse(input);
    if (!parsed.success || Object.keys(parsed.data.features).some((k) => !featureKeys.has(k))) {
      throw new AppError("VALIDATION_FAILED", { detail: "features" });
    }
    await requireActor({ anyRole: LISTING_ROLES });
    const supabase = await createSessionClient();
    const entries = Object.entries(parsed.data.features).filter(([, v]) => v !== null && v !== "" && v !== "false");
    const keep = entries.map(([k]) => k);
    const del = supabase.from("property_features").delete().eq("property_id", parsed.data.propertyId);
    const { error: delError } = keep.length ? await del.not("feature_key", "in", `(${keep.join(",")})`) : await del;
    if (delError) throw fromDatabaseError(delError);
    if (entries.length) {
      const { error } = await supabase.from("property_features").upsert(
        entries.map(([feature_key, feature_value]) => ({ property_id: parsed.data.propertyId, feature_key, feature_value })),
        { onConflict: "property_id,feature_key" },
      );
      if (error) throw fromDatabaseError(error);
    }
    return { saved: entries.length };
  });
}
