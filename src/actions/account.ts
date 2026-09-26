"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/api/response";
import { LISTING_ROLES, hasAnyRole, requireActor } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { siteUrl } from "@/lib/site";
import { createSessionClient } from "@/lib/supabase/server";

// Profile, onboarding and seller inbox actions. Identity fields (phone) are
// never editable here (GAP-07); email changes go through Supabase Auth's
// confirmation flow and reach profiles.email only once confirmed.

const nameSchema = z.string().trim().min(2, "Enter your full name").max(100);

export async function updateNameAction(input: { fullName: string }) {
  return runAction("profile.update", async () => {
    const parsed = nameSchema.safeParse(input.fullName);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", { detail: "full_name" });
    const actor = await requireActor();
    const supabase = await createSessionClient();
    const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", actor.id);
    if (error) throw fromDatabaseError(error);
    revalidatePath("/dashboard", "layout");
    return { fullName: parsed.data };
  });
}

export async function requestEmailChangeAction(input: { email: string }) {
  return runAction("account.updateEmail", async () => {
    const parsed = z.email().max(254).safeParse(input.email.trim().toLowerCase());
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", { detail: "email" });
    await requireActor();
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data },
      { emailRedirectTo: siteUrl("/dashboard/profile?email=confirmed") },
    );
    if (error) {
      if (error.status === 429) throw new AppError("RATE_LIMITED", { cause: error });
      throw new AppError("VALIDATION_FAILED", { detail: "email", cause: error });
    }
    return { pendingEmail: parsed.data };
  });
}

export async function becomeSellerAction(input: { sellerType: "owner" | "developer" }) {
  return runAction("role.becomeSeller", async () => {
    if (input.sellerType !== "owner" && input.sellerType !== "developer") throw new AppError("VALIDATION_FAILED");
    await requireActor();
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc("become_seller", { p_seller_type: input.sellerType });
    if (error) throw fromDatabaseError(error);
    revalidatePath("/dashboard", "layout");
    return data as { added: boolean };
  });
}

const onboardingSchema = z.object({
  fullName: nameSchema,
  intent: z.enum(["buy", "owner", "developer"]).optional(),
});

/** First-login onboarding: saves the name and, for sellers, adds seller tools
 *  in one step. Buyers need nothing more (every account can browse and enquire). */
export async function completeOnboardingAction(input: { fullName: string; intent?: "buy" | "owner" | "developer"; next?: string }) {
  return runAction("onboarding.complete", async () => {
    const parsed = onboardingSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", { detail: parsed.error.issues[0]?.path.join(".") });
    const actor = await requireActor();
    const supabase = await createSessionClient();
    const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", actor.id);
    if (error) throw fromDatabaseError(error);

    const intent = parsed.data.intent;
    const selling = (intent === "owner" || intent === "developer") && !hasAnyRole(actor, LISTING_ROLES);
    if (selling) {
      const { error: roleError } = await supabase.rpc("become_seller", { p_seller_type: intent });
      if (roleError) throw fromDatabaseError(roleError);
    }
    revalidatePath("/dashboard", "layout");
    // A new seller goes straight to posting; a buyer returns to the page they
    // were acting on (save, enquire), otherwise their dashboard.
    return { redirectTo: selling ? "/dashboard/properties/new" : safeNextPath(input.next, "/dashboard") };
  });
}

export async function updateEnquiryStatusAction(input: { enquiryId: string; status: "read" | "closed" }) {
  return runAction("enquiry.updateStatus", async () => {
    if (!z.uuid().safeParse(input.enquiryId).success || !["read", "closed"].includes(input.status)) {
      throw new AppError("VALIDATION_FAILED");
    }
    await requireActor();
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc("update_enquiry_status", { p_enquiry_id: input.enquiryId, p_status: input.status });
    if (error) throw fromDatabaseError(error);
    revalidatePath("/admin/enquiries");
    return data as { status: string; changed: boolean };
  });
}
