import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { NewListingForm } from "@/components/dashboard/new-listing-form";
import { LISTING_ROLES, hasAnyRole, requireActor } from "@/lib/auth/dal";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  const actor = await requireActor();
  if (!hasAnyRole(actor, LISTING_ROLES)) redirect("/dashboard/profile");
  return (
    <>
      <PageHeader title="New listing" description="Choose what you're listing to get started. You can fill in the rest and come back anytime before submitting." />
      <NewListingForm />
    </>
  );
}
