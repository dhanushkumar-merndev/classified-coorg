import { Heart } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { UnavailableRow } from "@/components/dashboard/unavailable-row";
import { PropertyCard } from "@/components/property/property-card";
import { ResultsPagination } from "@/components/search/results-pagination";
import { requireActor } from "@/lib/auth/dal";
import { listSaved } from "@/repositories/account";
import { toCard, type RawCard } from "@/repositories/public-listings";

export const metadata = { title: "Saved properties" };

export default async function SavedPage({ searchParams }: PageProps<"/dashboard/saved">) {
  const actor = await requireActor();
  const page = Number((await searchParams).page ?? 1) || 1;
  const saved = await listSaved(actor.id, page);

  return (
    <>
      <PageHeader title="Saved properties" description={`${saved.total} saved`} />
      {saved.items.length === 0 ? (
        <EmptyState icon={Heart} title="No saved properties yet" description="Tap the heart on any listing to keep it here."
          action={{ href: "/properties", label: "Browse properties" }} />
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {saved.items.map((row) => (
              <li key={row.property_id}>
                {row.property
                  ? <PropertyCard listing={toCard(row.property as unknown as RawCard)} />
                  : <UnavailableRow propertyId={row.property_id} />}
              </li>
            ))}
          </ul>
          <ResultsPagination page={saved.page} pageCount={saved.pageCount} hrefFor={(p) => `/dashboard/saved?page=${p}`} />
        </>
      )}
    </>
  );
}
