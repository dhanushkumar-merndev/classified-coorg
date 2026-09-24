import { PageHeader } from "@/components/dashboard/page-header";
import { ProfileForms } from "@/components/dashboard/profile-forms";
import { LISTING_ROLES, hasAnyRole, requireActor } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import { getMyProfile } from "@/repositories/account";

export const metadata = { title: "Profile & settings" };

export default async function ProfilePage({ searchParams }: PageProps<"/dashboard/profile">) {
  const actor = await requireActor();
  const profile = await getMyProfile(actor.id);
  const emailConfirmed = (await searchParams).email === "confirmed";
  return (
    <>
      <PageHeader title="Profile & settings" description={`Member since ${formatDate(profile.created_at)}`} />
      <ProfileForms
        fullName={profile.full_name ?? ""}
        phone={profile.phone ?? ""}
        email={profile.email}
        pendingEmail={profile.pendingEmail}
        emailConfirmed={emailConfirmed}
        isSeller={hasAnyRole(actor, LISTING_ROLES)}
        roles={[...actor.roles].map((r) => ROLE_LABELS[r] ?? r)}
      />
    </>
  );
}
