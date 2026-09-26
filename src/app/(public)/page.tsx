import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, MapPin } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { TypeIcon } from "@/components/property/type-icon";
import { HeroSearch } from "@/components/search/hero-search";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/site/faq-section";
import { MobileCollapsibleList } from "@/components/site/mobile-collapsible-list";
import { SectionHeading } from "@/components/site/page-intro";
import { RotatingWords } from "@/components/site/rotating-words";
import { formatDate } from "@/lib/format";
import { getGuideImage } from "@/lib/guides";
import { PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
import { jsonLd, organizationLd, websiteLd } from "@/lib/seo";
import {
  getFeaturedListings, getLocationCounts, getLocations, getPublishedArticles, searchListings,
} from "@/repositories/public-listings";
import { parseSearchParams } from "@/schemas/search.schema";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Land in Coorg — Verified Coffee Estates, Farmland & Plots for Sale",
  description:
    "Explore 100+ verified coffee estates, agricultural farmland, residential plots, and plantation bungalows for sale across Coorg (Kodagu), Karnataka. Title and RTC verified.",
  alternates: { canonical: "/" },
};

const POPULAR = [
  { href: "/properties?location=madikeri", label: "Madikeri" },
  { href: "/properties?location=kushalnagar", label: "Kushalnagar" },
  { href: "/properties?location=virajpet", label: "Virajpet" },
  { href: "/properties?type=coffee-estate", label: "Coffee estates" },
  { href: "/properties?type=farm-land", label: "Farm land" },
];

const HERO_WORDS = ["coffee estates", "farmland", "homestays", "residential plots", "villas"] as const;

export default async function HomePage() {
  const [locations, counts, featured, recent, articles] = await Promise.all([
    getLocations(),
    getLocationCounts(),
    getFeaturedListings(6),
    searchListings(parseSearchParams({})),
    getPublishedArticles(3),
  ]);
  const towns = locations.filter((l) => l.parent_id !== null);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([websiteLd(), organizationLd()])}
      />
      <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden bg-[#172c22] text-white">
        <Image
          src="/images/hero-coorg-landscape.webp"
          alt="Forested hills and open fields in Coorg at sunset"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="-z-20 object-cover object-[60%_center] md:object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(12,29,22,0.55)_0%,rgba(12,29,22,0.2)_55%,rgba(12,29,22,0.06)_100%)]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(12,29,22,0.35),transparent_55%)]" />

        <div className="wrap relative flex min-h-[37.5rem] flex-col justify-center py-12 md:min-h-[38.75rem] md:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.18em] text-white/85">LAND & HOMES IN KODAGU</p>
            <h1 id="hero-heading" className="mt-5 text-[2.75rem] leading-[1.08] font-medium tracking-[-0.035em] sm:text-6xl lg:text-[4.25rem]">
              Find your place<br />in Coorg.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/90 md:text-lg">
              <span className="block">
                Verified <RotatingWords words={HERO_WORDS} className="font-semibold text-white" />
              </span>
              A quieter way of life in the hills.
            </p>
          </div>

          <div className="mt-8 w-full text-foreground md:mt-10">
            <HeroSearch locations={towns.map((l) => ({ slug: l.slug, name: l.name }))} />
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-6">
            <nav aria-label="Popular searches" className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="text-white/75">Popular:</span>
              {POPULAR.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="rounded-sm py-1 text-white/95 underline decoration-white/40 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline-white"
                >
                  {c.label}
                </Link>
              ))}
            </nav>
            <p className="hidden items-center gap-1.5 py-1 text-xs text-white/80 lg:flex">
              <MapPin className="size-3.5" aria-hidden="true" /> Coorg, Karnataka
            </p>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="wrap pt-16">
          <SectionHeading title="Featured" aside={<MoreLink href="/properties">View all</MoreLink>} />
          <PropertyGrid listings={featured} priorityCount={3} collapsibleOnMobile={true} />
        </section>
      )}

      <section className="wrap py-16">
        <SectionHeading title="Recently verified" aside={<MoreLink href="/properties">View all</MoreLink>} />
        {recent.items.length > 0 ? (
          <PropertyGrid listings={recent.items.slice(0, 6)} priorityCount={featured.length ? 0 : 3} collapsibleOnMobile={true} />
        ) : (
          <EmptyState icon={Building2} title="The first listings are in review"
            description="Verified properties appear here as soon as our team approves them."
            action={{ href: "/dashboard/properties/new", label: "Post a property" }} />
        )}
      </section>

      <section className="wrap pb-16">
        <SectionHeading title="Browse by location" aside={<MoreLink href="/locations">All locations</MoreLink>} />
        <MobileCollapsibleList initialCount={4} moreLabel="See more locations">
          {towns.map((l) => (
            <Link
              key={l.id}
              href={`/locations/${l.slug}`}
              className="group flex items-center justify-between gap-2 rounded-md border bg-card px-4 py-3.5 transition-colors hover:border-primary"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover:text-primary">{l.name}</span>
                <span className="text-xs text-muted-foreground">{counts[l.id] ?? 0} {counts[l.id] === 1 ? "listing" : "listings"}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </Link>
          ))}
        </MobileCollapsibleList>
      </section>

      <section className="wrap pb-16">
        <SectionHeading title="Browse by type" aside={<MoreLink href="/property-types">All types</MoreLink>} />
        <MobileCollapsibleList initialCount={4} moreLabel="See more property types">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/properties?type=${toSlug(value)}`}
              className="group flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary"
            >
              <TypeIcon type={value} />
              <span className="min-w-0 truncate text-sm font-medium group-hover:text-primary">{label}</span>
            </Link>
          ))}
        </MobileCollapsibleList>
      </section>

      {articles.length > 0 && (
        <section className="wrap pb-16">
          <SectionHeading title="Before you buy" aside={<MoreLink href="/guides">All guides</MoreLink>} />
          <ul className="grid gap-5 md:grid-cols-3" role="list">
            {articles.map((a) => {
              const guideImg = getGuideImage(a.slug);
              return (
                <li key={a.id}>
                  <Link
                    href={`/guides/${a.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary hover:shadow-md"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted select-none">
                      <Image
                        src={guideImg.src}
                        alt={guideImg.alt}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <span className="text-xs text-muted-foreground">{formatDate(a.published_at)}</span>
                      <h3 className="line-clamp-2 font-semibold text-base leading-snug group-hover:text-primary">{a.title}</h3>
                      {a.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <FaqSection className="wrap pb-16" />

      <section className="wrap pb-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-md bg-primary px-6 py-10 text-primary-foreground md:flex-row md:items-center md:px-10">
          <div className="space-y-2">
            <h2 className="font-display text-2xl md:text-3xl">Selling land in Coorg?</h2>
            <p className="text-white/80">List it free. We review it and publish it as Verified.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-foreground hover:bg-white/90">
              <Link href="/dashboard/properties/new">Post a property <ArrowRight /></Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link href="/verification">How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline hover:underline-offset-4">
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
