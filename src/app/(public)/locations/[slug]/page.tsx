import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, MapPin } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { ResultsPagination } from "@/components/search/results-pagination";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { breadcrumbLd, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { getLocationCounts, getLocations, getPublishedArticles, searchListings } from "@/repositories/public-listings";
import { parseSearchParams } from "@/schemas/search.schema";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getLocations()).map((l) => ({ slug: l.slug }));
}

async function findLocation(slug: string) {
  const location = (await getLocations()).find((l) => l.slug === slug);
  if (!location) notFound();
  return location;
}

export async function generateMetadata({ params }: PageProps<"/locations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const loc = (await getLocations()).find((l) => l.slug === slug);
  if (!loc) return { title: "Location not found", robots: { index: false } };
  return {
    title: loc.seo_title ?? `Land and property for sale in ${loc.name}, Coorg`,
    description: loc.seo_description ?? `Verified coffee estates, farm land and plots for sale in ${loc.name}, Kodagu.`,
    alternates: { canonical: `/locations/${loc.slug}` },
  };
}

export default async function LocationPage({ params }: PageProps<"/locations/[slug]">) {
  const { slug } = await params;
  const location = await findLocation(slug);
  const [locations, counts, results, guides] = await Promise.all([
    getLocations(),
    getLocationCounts(),
    searchListings(parseSearchParams({ location: slug })),
    getPublishedArticles(3),
  ]);
  const nearby = locations.filter((l) => l.id !== location.id && l.parent_id === location.parent_id && l.parent_id !== null);
  const children = locations.filter((l) => l.parent_id === location.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd([
        { name: "Home", url: siteUrl("/") },
        { name: "Locations", url: siteUrl("/locations") },
        { name: location.name, url: siteUrl(`/locations/${location.slug}`) },
      ]))} />
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/locations">Locations</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{location.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Property for sale in {location.name}</h1>
        {location.intro ? (
          <p className="whitespace-pre-line text-muted-foreground">{location.intro}</p>
        ) : (
          <p className="text-muted-foreground">Verified listings in {location.name}, Kodagu district.</p>
        )}
      </header>

      <section aria-labelledby="loc-results" className="mt-8 space-y-6">
        <div className="flex items-end justify-between">
          <h2 id="loc-results" className="text-xl font-semibold">{results.total} verified {results.total === 1 ? "listing" : "listings"}</h2>
          {results.total > 0 && <Link href={`/properties?location=${location.slug}`} className="text-sm font-medium text-primary hover:underline">Filter these results</Link>}
        </div>
        {results.items.length > 0 ? (
          <>
            <PropertyGrid listings={results.items} priorityCount={3} />
            <ResultsPagination page={1} pageCount={results.pageCount} hrefFor={(p) => `/properties?location=${location.slug}${p > 1 ? `&page=${p}` : ""}`} />
          </>
        ) : (
          <EmptyState icon={Building2} title={`No verified listings in ${location.name} yet`}
            description="Check nearby areas, or list your own property here."
            action={{ href: "/properties", label: "Browse all of Coorg" }} />
        )}
      </section>

      {(nearby.length > 0 || children.length > 0) && (
        <section aria-labelledby="nearby" className="mt-14 space-y-4">
          <h2 id="nearby" className="text-xl font-semibold">{children.length ? "Areas within " + location.name : "Nearby locations"}</h2>
          <ul className="flex flex-wrap gap-2">
            {(children.length ? children : nearby).map((l) => (
              <li key={l.id}>
                <Link href={`/locations/${l.slug}`} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm hover:border-primary">
                  <MapPin className="size-3.5 text-primary" aria-hidden="true" /> {l.name} <span className="text-muted-foreground">({counts[l.id] ?? 0})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guides.length > 0 && (
        <section aria-labelledby="loc-guides" className="mt-14 space-y-4">
          <h2 id="loc-guides" className="text-xl font-semibold">Buying guides</h2>
          <ul className="space-y-2">
            {guides.map((g) => <li key={g.id}><Link href={`/guides/${g.slug}`} className="text-primary hover:underline">{g.title}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
