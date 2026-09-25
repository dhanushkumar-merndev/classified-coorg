"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/api/response";
import { requireActor } from "@/lib/auth/dal";
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
