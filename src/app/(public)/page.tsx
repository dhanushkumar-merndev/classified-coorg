import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, FileLock2, ShieldCheck, Smartphone } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { TypeIcon } from "@/components/property/type-icon";
import { HeroSearch } from "@/components/search/hero-search";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/site/page-intro";
import { formatDate } from "@/lib/format";
import { PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
import {
  getFeaturedListings, getLocationCounts, getLocations, getPublishedArticles, searchListings,
} from "@/repositories/public-listings";
import { parseSearchParams } from "@/schemas/search.schema";

export const revalidate = 300;

const POPULAR = [
  { href: "/properties?location=madikeri", label: "Madikeri" },
  { href: "/properties?location=kushalnagar", label: "Kushalnagar" },
  { href: "/properties?location=virajpet", label: "Virajpet" },
  { href: "/properties?type=coffee-estate", label: "Coffee estates" },
  { href: "/properties?type=farm-land", label: "Farm land" },
];

const PROMISES = [
  { icon: ShieldCheck, label: "Every listing reviewed" },
  { icon: Smartphone, label: "Phone-verified sellers" },
  { icon: FileLock2, label: "Documents kept private" },
];

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
      <section className="border-b bg-muted/60">
        <div className="wrap py-14 md:py-20">
          <div className="max-w-3xl space-y-4">
            <h1 className="font-display text-4xl leading-[1.1] text-balance md:text-5xl">
              Verified land and estates in Coorg
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Coffee estates, farm land, plots and homes. Every listing is checked before it goes live.
            </p>
          </div>
          <div className="mt-8">
            <HeroSearch locations={towns.map((l) => ({ slug: l.slug, name: l.name }))} />
          </div>
          <nav aria-label="Popular searches" className="mt-4 flex flex-wrap items-center gap-2">
            {POPULAR.map((c) => (
              <Link key={c.href} href={c.href}
                className="rounded-md border bg-card px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-primary">
                {c.label}
              </Link>
            ))}
          </nav>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3" role="list">
            {PROMISES.map((p) => (
              <li key={p.label} className="flex items-center gap-2 text-sm font-medium">
                <p.icon className="size-4 text-primary" aria-hidden="true" /> {p.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="wrap pt-16">
          <SectionHeading title="Featured" aside={<MoreLink href="/properties">View all</MoreLink>} />
          <PropertyGrid listings={featured} priorityCount={3} />
        </section>
      )}

      <section className="wrap py-16">
        <SectionHeading title="Recently verified" aside={<MoreLink href="/properties">View all</MoreLink>} />
        {recent.items.length > 0 ? (
          <PropertyGrid listings={recent.items.slice(0, 6)} priorityCount={featured.length ? 0 : 3} />
        ) : (
          <EmptyState icon={Building2} title="The first listings are in review"
            description="Verified properties appear here as soon as our team approves them."
            action={{ href: "/dashboard/properties/new", label: "Post a property" }} />
        )}
      </section>

      <section className="wrap pb-16">
        <SectionHeading title="Browse by location" aside={<MoreLink href="/locations">All locations</MoreLink>} />
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" role="list">
          {towns.map((l) => (
            <li key={l.id}>
              <Link href={`/locations/${l.slug}`}
                className="group flex items-center justify-between gap-2 rounded-md border bg-card px-4 py-3.5 transition-colors hover:border-primary">
                <span className="min-w-0">
                  <span className="block truncate font-medium group-hover:text-primary">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{counts[l.id] ?? 0} {counts[l.id] === 1 ? "listing" : "listings"}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap pb-16">
        <SectionHeading title="Browse by type" aside={<MoreLink href="/property-types">All types</MoreLink>} />
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" role="list">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <li key={value}>
              <Link href={`/properties?type=${toSlug(value)}`}
                className="group flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary">
                <TypeIcon type={value} />
                <span className="min-w-0 truncate text-sm font-medium group-hover:text-primary">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {articles.length > 0 && (
        <section className="wrap pb-16">
          <SectionHeading title="Before you buy" aside={<MoreLink href="/guides">All guides</MoreLink>} />
          <ul className="grid gap-4 md:grid-cols-3" role="list">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/guides/${a.slug}`} className="group flex h-full flex-col gap-2 rounded-md border bg-card p-5 transition-colors hover:border-primary">
                  <span className="text-xs text-muted-foreground">{formatDate(a.published_at)}</span>
                  <span className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{a.title}</span>
                  {a.excerpt && <span className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
