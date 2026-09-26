import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, LISTING_ROLES, hasAnyRole, requirePageActor } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

// First-login onboarding: name, then what brings the user here. Shown once —
// an account with a name goes straight on.
export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const actor = await requirePageActor("/onboarding");
  const next = safeNextPath((await searchParams).next, "");
  if (actor.fullName) redirect(next || "/dashboard");
  // Sellers, agents and admins already have their tools; they only need a name.
  const askIntent = !hasAnyRole(actor, [...LISTING_ROLES, ...ADMIN_ROLES]);
  return <OnboardingForm next={next || undefined} askIntent={askIntent} />;
}
