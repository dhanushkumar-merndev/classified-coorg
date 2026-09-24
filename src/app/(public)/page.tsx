import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Coffee, Home, Leaf, MapPin, ShieldCheck, Sprout, Trees } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { HeroSearch } from "@/components/search/hero-search";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
import {
  getFeaturedListings, getLocationCounts, getLocations, getPublishedArticles, searchListings,
} from "@/repositories/public-listings";
import { parseSearchParams } from "@/schemas/search.schema";

export const revalidate = 300;

const TYPE_ICONS: Record<string, typeof Coffee> = {
  coffee_estate: Coffee, agricultural_land: Sprout, farm_land: Leaf, residential_plot: MapPin,
  commercial_land: Building2, house_villa: Home, homestay_resort: Trees, other: Building2,
};

const CHIPS = [
  { href: "/properties?location=madikeri", label: "Madikeri" },
  { href: "/properties?location=kushalnagar", label: "Kushalnagar" },
  { href: "/properties?location=virajpet", label: "Virajpet" },
  { href: "/properties?type=coffee-estate", label: "Coffee estates" },
  { href: "/properties?type=farm-land", label: "Farm land" },
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
      <section className="border-b bg-gradient-to-b from-accent/60 to-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
          <div className="max-w-3xl space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" /> Every listing reviewed before it goes live
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-secondary md:text-6xl">
              Find verified land and properties in Coorg
            </h1>
            <p className="text-lg text-muted-foreground">Discover estates, plots and land across Kodagu.</p>
          </div>
          <div className="mt-8 max-w-5xl">
            <HeroSearch locations={towns.map((l) => ({ slug: l.slug, name: l.name }))} />
          </div>
          <nav aria-label="Popular searches" className="mt-5 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <Link key={c.href} href={c.href} className="rounded-full border bg-card px-4 py-2 text-sm hover:border-primary hover:text-primary">
                {c.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {featured.length > 0 && (
        <Section title="Featured properties" href="/properties" linkLabel="View all">
          <PropertyGrid listings={featured} priorityCount={3} />
        </Section>
      )}

      <Section title="Recently verified" href="/properties" linkLabel="Browse all properties">
        {recent.items.length > 0 ? (
          <PropertyGrid listings={recent.items.slice(0, 6)} priorityCount={featured.length ? 0 : 3} />
        ) : (
          <EmptyState icon={Building2} title="No verified listings yet"
            description="New properties appear here as soon as our team verifies them."
            action={{ href: "/dashboard/properties/new", label: "Post the first property" }} />
        )}
      </Section>

      <Section title="Popular locations" href="/locations" linkLabel="All locations" muted>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="list">
          {towns.map((l) => (
            <li key={l.id}>
              <Link href={`/locations/${l.slug}`} className="flex items-center justify-between rounded-xl border bg-card p-4 hover:border-primary">
                <span className="flex items-center gap-2 font-medium"><MapPin className="size-4 text-primary" aria-hidden="true" /> {l.name}</span>
                <span className="text-sm text-muted-foreground">{counts[l.id] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Browse by property type" href="/property-types" linkLabel="All types">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" role="list">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => {
            const Icon = TYPE_ICONS[value] ?? Building2;
            return (
              <li key={value}>
                <Link href={`/properties?type=${toSlug(value)}`} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 hover:border-primary">
                  <Icon className="size-6 text-primary" aria-hidden="true" />
                  <span className="font-medium">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {articles.length > 0 && (
        <Section title="Guides for buyers" href="/guides" linkLabel="All guides" muted>
          <ul className="grid gap-5 md:grid-cols-3" role="list">
            {articles.map((a) => (
              <li key={a.id}>
                <Card className="h-full gap-3 p-6">
                  <BookOpen className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold"><Link href={`/guides/${a.slug}`} className="hover:underline">{a.title}</Link></h3>
                  {a.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{a.excerpt}</p>}
                  <p className="mt-auto text-xs text-muted-foreground">{formatDate(a.published_at)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-secondary p-8 text-secondary-foreground md:flex-row md:items-center md:p-12">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold md:text-3xl">Selling land or an estate in Coorg?</h2>
            <p className="max-w-xl text-white/75">List it for free. Our team reviews your documents so buyers can trust your listing.</p>
          </div>
          <Button asChild size="lg" className="bg-white text-secondary hover:bg-white/90">
            <Link href="/dashboard/properties/new">Post your property <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function Section({ title, href, linkLabel, muted = false, children }: {
  title: string; href: string; linkLabel: string; muted?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={muted ? "bg-muted/60" : undefined}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-6 md:py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {children}
      </div>
    </section>
  );
}
