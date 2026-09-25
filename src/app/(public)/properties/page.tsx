import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { ResultsPagination } from "@/components/search/results-pagination";
import { DesktopFilters, MobileFilters, SortSelect } from "@/components/search/search-filters";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatCount } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { getLocations, searchListings } from "@/repositories/public-listings";
import { activeFilterCount, parseSearchParams, toQueryString } from "@/schemas/search.schema";

// SEO policy (GAP-18 PROPOSED): the unfiltered list and simple single
// location/type pages are indexable; other filter combinations are noindex
// and canonicalize to the base list.
export async function generateMetadata({ searchParams }: PageProps<"/properties">): Promise<Metadata> {
  const filters = parseSearchParams(await searchParams);
  const locations = await getLocations();
  const loc = locations.find((l) => l.slug === filters.location);
  const type = filters.type ? PROPERTY_TYPE_LABELS[filters.type] : null;
  const title = [type ?? "Properties", "for sale in", loc ? `${loc.name}, Coorg` : "Coorg"].join(" ");
  const simple = activeFilterCount(filters) <= 1 && !filters.q && (filters.location || filters.type || activeFilterCount(filters) === 0);
  const canonical = simple ? `/properties${toQueryString({ location: filters.location, type: filters.type, page: filters.page })}` : "/properties";
  return {
    title: filters.page > 1 ? `${title} — page ${filters.page}` : title,
    description: `Browse verified ${type?.toLowerCase() ?? "land, estates and plots"} in ${loc?.name ?? "Coorg (Kodagu)"}. Every listing is reviewed before publication.`,
    alternates: { canonical },
    robots: simple ? undefined : { index: false, follow: true },
  };
}

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const filters = parseSearchParams(await searchParams);
  const [result, locations] = await Promise.all([searchListings(filters), getLocations()]);
  const towns = locations.filter((l) => l.parent_id !== null).map((l) => ({ slug: l.slug, name: l.name }));
  const loc = locations.find((l) => l.slug === filters.location);
  const heading = `${filters.type ? PROPERTY_TYPE_LABELS[filters.type] : "Properties"} in ${loc?.name ?? "Coorg"}`;

  return (
    <div className="wrap py-8">
      <Breadcrumb className="mb-5">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Properties</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex gap-8">
        <DesktopFilters filters={filters} locations={towns} />
        <section className="min-w-0 flex-1" aria-labelledby="results-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 id="results-heading" className="font-display text-2xl leading-tight md:text-3xl">{heading}</h1>
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                {formatCount(result.total)} verified {result.total === 1 ? "listing" : "listings"}
              </p>
            </div>
            <div className="flex gap-2">
              <MobileFilters filters={filters} locations={towns} />
              <SortSelect filters={filters} />
            </div>
          </div>
          {result.items.length > 0 ? (
            <>
              <PropertyGrid listings={result.items} priorityCount={3} />
              <ResultsPagination page={result.page} pageCount={result.pageCount}
                hrefFor={(page) => `/properties${toQueryString(filters, { page })}`} />
            </>
          ) : (
            <EmptyState icon={SearchX} title="No properties match these filters"
              description="Try widening the price or area range, or search all of Coorg."
              action={{ href: "/properties", label: "Clear all filters" }} />
          )}
        </section>
      </div>
    </div>
  );
}
