import { Clock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ClearHistoryButton } from "@/components/dashboard/clear-history-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { PropertyCard } from "@/components/property/property-card";
import { requireActor } from "@/lib/auth/dal";
import { listRecentlyViewed } from "@/repositories/account";
import { toCard, type RawCard } from "@/repositories/public-listings";

export const metadata = { title: "Recently viewed" };

export default async function RecentPage() {
  const actor = await requireActor();
  // Listings that are no longer public simply drop out (HISTORY privacy).
  const rows = (await listRecentlyViewed(actor.id)).filter((r) => r.property);

  return (
    <>
      <PageHeader title="Recently viewed" description="Only you can see this list." actions={rows.length > 0 ? <ClearHistoryButton /> : undefined} />
      {rows.length === 0 ? (
        <EmptyState icon={Clock} title="No recently viewed properties" description="Listings you open will appear here."
          action={{ href: "/properties", label: "Browse properties" }} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" role="list">
          {rows.map((r) => <li key={r.property_id}><PropertyCard listing={toCard(r.property as unknown as RawCard)} /></li>)}
        </ul>
      )}
    </>
  );
}
