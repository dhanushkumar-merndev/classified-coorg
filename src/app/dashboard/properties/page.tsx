import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/property/badges";
import { PropertyImage } from "@/components/property/property-image";
import { Button } from "@/components/ui/button";
import { ResultsPagination } from "@/components/search/results-pagination";
import { requireActor } from "@/lib/auth/dal";
import { formatDate, formatPriceShort, formatArea } from "@/lib/format";
import { mediaUrl } from "@/lib/site";
import { getEnquiryCounts, listMyListings } from "@/repositories/account";

export const metadata = { title: "My properties" };

export default async function MyPropertiesPage({ searchParams }: PageProps<"/dashboard/properties">) {
  const actor = await requireActor();
  const page = Number((await searchParams).page ?? 1) || 1;
  const [listings, enquiryCounts] = await Promise.all([listMyListings(actor.id, page), getEnquiryCounts()]);

  return (
    <>
      <PageHeader title="My properties" description={`${listings.total} listing${listings.total === 1 ? "" : "s"}`}
        actions={<Button asChild><Link href="/dashboard/properties/new"><Plus /> New listing</Link></Button>} />
      {listings.items.length === 0 ? (
        <EmptyState icon={Building2} title="No listings yet" description="Add your property to get it verified and published."
          action={{ href: "/dashboard/properties/new", label: "Add a property" }} />
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {listings.items.map((row) => {
              const counts = enquiryCounts[row.id];
              return (
                <li key={row.id}>
                  <Link href={`/dashboard/properties/${row.id}`} className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                    <div className="relative aspect-[4/3] bg-muted">
                      <PropertyImage src={row.cover?.[0] ? mediaUrl(row.cover[0].id, "thumb") : null} alt={row.title ?? "Untitled listing"} />
                      <StatusBadge status={row.status} className="absolute left-2 top-2 bg-card" />
                    </div>
                    <div className="space-y-1.5 p-4">
                      <p className="line-clamp-1 font-medium group-hover:underline">{row.title || "Untitled draft"}</p>
                      <p className="text-sm text-muted-foreground">{formatPriceShort(row.price)} · {formatArea(row.area_value, row.area_unit)}</p>
                      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                        <span>Updated {formatDate(row.updated_at)}</span>
                        {counts && counts.unread > 0 && (
                          <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground">{counts.unread} new enquir{counts.unread === 1 ? "y" : "ies"}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <ResultsPagination page={listings.page} pageCount={listings.pageCount} hrefFor={(p) => `/dashboard/properties?page=${p}`} />
        </>
      )}
    </>
  );
}
