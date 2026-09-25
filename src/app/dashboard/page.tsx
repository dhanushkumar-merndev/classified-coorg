import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { KpiCard, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LISTING_ROLES, hasAnyRole, requireActor } from "@/lib/auth/dal";
import { getOverview } from "@/repositories/account";

export const metadata = { title: "Overview" };

export default async function DashboardOverview() {
  const actor = await requireActor();
  const isSeller = hasAnyRole(actor, LISTING_ROLES);
  const o = await getOverview(actor.id, isSeller);
  const active = o.byStatus.verified ?? 0;
  const inReview = (o.byStatus.submitted ?? 0) + (o.byStatus.under_review ?? 0);
  const needsAction = (o.byStatus.changes_required ?? 0) + (o.byStatus.draft ?? 0);

  return (
    <>
      <PageHeader
        title={`Welcome${actor.fullName ? `, ${actor.fullName.split(" ")[0]}` : ""}`}
        description="Here is what needs your attention."
        actions={<Button asChild><Link href="/dashboard/properties/new"><Plus /> Post property</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isSeller && <KpiCard label="Active listings" value={active} />}
        {isSeller && <KpiCard label="Under review" value={inReview} />}
        {isSeller && <KpiCard label="Interested buyers" value={o.interestedBuyers} hint="Our team handles every enquiry" />}
        <KpiCard label="Saved properties" value={o.saved} />
        {!isSeller && <KpiCard label="Enquiries sent" value={o.sentEnquiries} />}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {isSeller && needsAction > 0 && (
          <ActionCard href="/dashboard/properties" title={`${needsAction} listing${needsAction === 1 ? " needs" : "s need"} your action`}
            body="Finish drafts or make the changes our reviewers requested." />
        )}
        {isSeller && o.interestedBuyers > 0 && (
          <ActionCard href="/dashboard/properties" title={`${o.interestedBuyers} interested buyer${o.interestedBuyers === 1 ? "" : "s"}`}
            body="Our team speaks to buyers and arranges visits. We will call you when a buyer is ready." />
        )}
        {!isSeller && (
          <ActionCard href="/dashboard/profile" title="Selling a property?"
            body="Become a seller in one step, then post your land or estate for verification." />
        )}
        <ActionCard href="/properties" title="Find your next property" body="Browse verified listings across Coorg." />
      </div>
    </>
  );
}

function ActionCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Card className="gap-2 p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        Open <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Card>
  );
}
