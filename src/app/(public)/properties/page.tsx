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
import { getLocationImage } from "@/lib/locations";
import { getPropertyTypeImage } from "@/lib/property-types";
import { breadcrumbLd, itemListLd, jsonLd } from "@/lib/seo";
import { mediaUrl, propertyPath, siteUrl } from "@/lib/site";
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
  const baseTitle = [type ?? "Land & Properties", "for Sale in", loc ? `${loc.name}, Coorg` : "Coorg (Kodagu)"].join(" ");
  const title = filters.page > 1 ? `${baseTitle} — Page ${filters.page}` : baseTitle;
  const description = `Browse verified ${type?.toLowerCase() ?? "coffee estates, agricultural land, plots and houses"} in ${loc?.name ? `${loc.name}, Coorg` : "Coorg (Kodagu)"}. Every listing verified with clear titles and RTC documentation.`;
  const simple = activeFilterCount(filters) <= 1 && !filters.q && (filters.location || filters.type || activeFilterCount(filters) === 0);
  const canonical = simple ? `/properties${toQueryString({ location: filters.location, type: filters.type, page: filters.page })}` : "/properties";

  let ogImage = "/images/hero-coorg-landscape.webp";
  let ogAlt = "Properties and estates for sale in Coorg";
  if (filters.type) {
    const tImg = getPropertyTypeImage(filters.type);
    ogImage = tImg.src;
    ogAlt = tImg.alt;
  } else if (filters.location) {
    const lImg = getLocationImage(filters.location);
    ogImage = lImg.src;
    ogAlt = lImg.alt;
  }

  return {
    title,
    description,
    keywords: [
      type ? `${type.toLowerCase()} in Coorg` : "properties in Coorg",
      loc ? `property in ${loc.name}` : "land for sale in Coorg",
      "coffee estate for sale in Coorg",
      "buy land in Kodagu",
      "plots for sale in Coorg",
      "agricultural land Coorg",
      "verified property Coorg",
    ],
    alternates: { canonical },
    robots: simple ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: siteUrl(canonical),
      siteName: "Land in Coorg",
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: siteUrl(ogImage),
          width: 1200,
          height: 630,
          alt: ogAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteUrl(ogImage)],
    },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbLd([
          { name: "Home", url: siteUrl("/") },
          { name: "Properties", url: siteUrl("/properties") },
          ...(loc ? [{ name: loc.name, url: siteUrl(`/properties?location=${loc.slug}`) }] : []),
        ]))}
      />
      {result.items.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(itemListLd(
            result.items.map((item) => ({
              name: item.title,
              url: siteUrl(propertyPath(item.slug)),
              image: item.coverId ? siteUrl(mediaUrl(item.coverId, "full")) : undefined,
              description: `${PROPERTY_TYPE_LABELS[item.property_type] ?? "Property"} in ${item.location?.name ?? "Kodagu"}, Coorg`,
            }))
          ))}
        />
      )}
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
              <h2 className="mt-1 text-sm font-normal text-muted-foreground" aria-live="polite">
                {formatCount(result.total)} verified {result.total === 1 ? "listing" : "listings"}
              </h2>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
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
