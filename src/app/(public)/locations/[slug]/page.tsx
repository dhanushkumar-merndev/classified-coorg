import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { ResultsPagination } from "@/components/search/results-pagination";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getLocationImage } from "@/lib/locations";
import { breadcrumbLd, itemListLd, jsonLd, placeLd } from "@/lib/seo";
import { mediaUrl, propertyPath, siteUrl } from "@/lib/site";
import { PROPERTY_TYPE_LABELS } from "@/lib/labels";
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
  const locImg = getLocationImage(loc.slug);
  const title = loc.seo_title ?? `Land & Coffee Estates for Sale in ${loc.name}, Coorg`;
  const description =
    loc.seo_description ??
    `Verified coffee estates, agricultural farmland, residential plots, and homestay land for sale in ${loc.name}, Kodagu. Verified titles, Bhoomi RTC, direct owner contacts.`;
  const canonical = `/locations/${loc.slug}`;

  return {
    title,
    description,
    keywords: [
      `${loc.name} property for sale`,
      `${loc.name} coffee estate for sale`,
      `land for sale in ${loc.name} Coorg`,
      `farmland in ${loc.name} Kodagu`,
      `plots for sale in ${loc.name}`,
      `commercial land in ${loc.name}`,
      `homestay property in ${loc.name}`,
      `real estate ${loc.name} Coorg`,
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: siteUrl(canonical),
      siteName: "Land in Coorg",
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: siteUrl(locImg.src),
          width: 1200,
          height: 630,
          alt: locImg.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteUrl(locImg.src)],
    },
  };
}

export default async function LocationPage({ params }: PageProps<"/locations/[slug]">) {
  const { slug } = await params;
  const location = await findLocation(slug);
  const locImg = getLocationImage(location.slug);
  const [locations, counts, results, guides] = await Promise.all([
    getLocations(),
    getLocationCounts(),
    searchListings(parseSearchParams({ location: slug })),
    getPublishedArticles(3),
  ]);
  const nearby = locations.filter((l) => l.id !== location.id && l.parent_id === location.parent_id && l.parent_id !== null);
  const children = locations.filter((l) => l.parent_id === location.id);

  return (
    <div className="wrap py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbLd([
          { name: "Home", url: siteUrl("/") },
          { name: "Locations", url: siteUrl("/locations") },
          { name: location.name, url: siteUrl(`/locations/${location.slug}`) },
        ]))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(placeLd({
          name: `${location.name}, Coorg`,
          description: location.intro ?? `Land, coffee estates and properties for sale in ${location.name}, Kodagu.`,
          url: siteUrl(`/locations/${location.slug}`),
          image: siteUrl(locImg.src),
          containedInPlace: "Kodagu District, Karnataka, India",
        }))}
      />
      {results.items.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(itemListLd(
            results.items.map((item) => ({
              name: item.title,
              url: siteUrl(propertyPath(item.slug)),
              image: item.coverId ? siteUrl(mediaUrl(item.coverId, "full")) : undefined,
              description: `${PROPERTY_TYPE_LABELS[item.property_type] ?? "Property"} in ${location.name}, Coorg`,
            }))
          ))}
        />
      )}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/locations">Locations</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{location.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageIntro title={`Property for sale in ${location.name}`}
        lede={<span className="line-clamp-3 whitespace-pre-line">{location.intro ?? `Verified listings in ${location.name}, Kodagu district.`}</span>} />

      <section aria-labelledby="loc-results" className="mt-8 space-y-5">
        <div className="flex items-end justify-between">
          <h2 id="loc-results" className="text-sm font-medium text-muted-foreground">{results.total} verified {results.total === 1 ? "listing" : "listings"}</h2>
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
        <section aria-labelledby="nearby" className="mt-16 space-y-4">
          <h2 id="nearby" className="font-display text-xl">{children.length ? "Areas within " + location.name : "Nearby locations"}</h2>
          <ul className="flex flex-wrap gap-2">
            {(children.length ? children : nearby).map((l) => (
              <li key={l.id}>
                <Link href={`/locations/${l.slug}`} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary">
                  {l.name} <span className="text-muted-foreground">{counts[l.id] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guides.length > 0 && (
        <section aria-labelledby="loc-guides" className="mt-12 space-y-4">
          <h2 id="loc-guides" className="font-display text-xl">Buying guides</h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {guides.map((g) => (
              <li key={g.id}>
                <Link href={`/guides/${g.slug}`} className="block h-full rounded-md border bg-card p-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary">{g.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
