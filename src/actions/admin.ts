"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/api/response";
import { ADMIN_ROLES, requireActor } from "@/lib/auth/dal";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { createSessionClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/repositories/public-listings";
import { transitionProperty } from "@/services/property.service";

// Admin actions run with the admin's session; the database functions re-check
// the admin role, self-action rules and the last-super-admin invariant.

const reviewInput = z.strictObject({
  propertyId: z.uuid(),
  action: z.enum(["begin_review", "approve", "reject", "request_changes", "mark_sold", "archive"]),
  expectedVersion: z.int().positive(),
  revisionId: z.uuid().nullable().optional(),
  reason: z.string().trim().max(2000).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  requestId: z.uuid(),
});

export async function adminTransitionAction(input: unknown) {
  return runAction("admin.transition", async () => {
    await requireActor({ anyRole: ADMIN_ROLES });
    const parsed = reviewInput.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED");
    const result = await transitionProperty(parsed.data);
    revalidateTag(CACHE_TAGS.listings, { expire: 0 });
    revalidateTag(CACHE_TAGS.listing(parsed.data.propertyId), { expire: 0 });
    revalidatePath("/admin", "layout");
    return result;
  });
}

export async function adminSetFeaturedAction(input: { propertyId: string; featured: boolean; expectedVersion: number }) {
  return runAction("admin.featured", async () => {
    await requireActor({ anyRole: ADMIN_ROLES });
    const { error } = await (await createSessionClient()).rpc("admin_set_featured", {
      p_property_id: input.propertyId, p_featured: input.featured, p_expected_version: input.expectedVersion,
    });
    if (error) throw fromDatabaseError(error);
    revalidateTag(CACHE_TAGS.listings, { expire: 0 });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function adminSetSuspensionAction(input: { userId: string; suspended: boolean; reason: string }) {
  return runAction("admin.suspension", async () => {
    await requireActor({ anyRole: ADMIN_ROLES });
    if (!input.reason.trim()) throw new AppError("REASON_REQUIRED");
    const { error } = await (await createSessionClient()).rpc("admin_set_suspension", {
      p_user_id: input.userId, p_suspended: input.suspended, p_reason: input.reason,
    });
    if (error) throw fromDatabaseError(error);
    revalidateTag(CACHE_TAGS.listings, { expire: 0 });
    revalidatePath("/admin/users");
    return { ok: true };
  });
}

export async function adminChangeRoleAction(input: { userId: string; role: "seller" | "agent" | "admin" | "super_admin"; grant: boolean; reason: string }) {
  return runAction("admin.role", async () => {
    await requireActor({ anyRole: ADMIN_ROLES });
    if (!input.reason.trim()) throw new AppError("REASON_REQUIRED");
    const { error } = await (await createSessionClient()).rpc("admin_change_role", {
      p_user_id: input.userId, p_role: input.role, p_grant: input.grant, p_reason: input.reason,
    });
    if (error) throw fromDatabaseError(error);
    revalidatePath("/admin/users");
    return { ok: true };
  });
}

export async function adminAddNoteAction(input: { propertyId: string; note: string }) {
  return runAction("admin.note", async () => {
    await requireActor({ anyRole: ADMIN_ROLES });
    const { error } = await (await createSessionClient()).rpc("admin_add_note", {
      p_entity_type: "property", p_entity_id: input.propertyId, p_note: input.note,
    });
    if (error) throw fromDatabaseError(error);
    revalidatePath(`/admin/verification/${input.propertyId}`);
    return { ok: true };
  });
}
