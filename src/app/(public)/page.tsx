import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PropertyGrid } from "@/components/property/property-card";
import { HeroSearch } from "@/components/search/hero-search";
import { Button } from "@/components/ui/button";
import { Contours } from "@/components/site/contours";
import { SectionHeading } from "@/components/site/page-intro";
import { formatDate } from "@/lib/format";
import { PROPERTY_TYPE_BLURBS, PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
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
  { title: "Phone-verified sellers", body: "Every owner and agent signs in with a code sent to their mobile." },
  { title: "Documents checked privately", body: "RTC, khata and title papers are reviewed, never published." },
  { title: "Only approved listings shown", body: "Nothing appears here until a reviewer has signed it off." },
];

const SELL_STEPS = [
  { title: "Describe the property", body: "Price, area, location and what makes it worth a visit." },
  { title: "Add photos and papers", body: "Photos go public; land documents stay private to reviewers." },
  { title: "We review, then publish", body: "Usually quick. If something's missing, we tell you exactly what." },
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
      <section className="relative overflow-hidden border-b">
        <Contours className="absolute -right-56 -top-24 hidden w-[620px] text-primary/70 xl:block" />
        <div className="wrap relative pb-14 pt-14 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <div className="space-y-6">
              <p className="eyebrow">Kodagu · Karnataka</p>
              <h1 className="font-display text-[2.6rem] leading-[1.02] text-balance sm:text-6xl lg:text-[4.5rem]">
                Land in the hills, <span className="text-primary">checked</span> before it&rsquo;s listed.
              </h1>
              <p className="max-w-xl text-lg text-pretty text-muted-foreground">
                Coffee estates, farm land, plots and homes across Coorg. Our team reviews every listing against the seller&rsquo;s documents before it goes live.
              </p>
            </div>
            <ol className="relative hidden space-y-5 border-l bg-background/85 py-2 pl-8 backdrop-blur-[2px] lg:block">
              {PROMISES.map((p, i) => (
                <li key={p.title} className="grid grid-cols-[2rem_1fr] gap-x-2">
                  <span className="text-sm font-medium tabular-nums text-clay">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-sm text-muted-foreground">{p.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-12">
            <HeroSearch locations={towns.map((l) => ({ slug: l.slug, name: l.name }))} />
          </div>
          <nav aria-label="Popular searches" className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-muted-foreground">Popular:</span>
            {POPULAR.map((c) => (
              <Link key={c.href} href={c.href} className="underline decoration-border-strong underline-offset-4 hover:decoration-primary hover:text-primary">
                {c.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="wrap py-20">
          <SectionHeading title="Featured" aside={<MoreLink href="/properties">View all</MoreLink>} />
          <PropertyGrid listings={featured} priorityCount={3} />
        </section>
      )}

      <section className="wrap py-20">
        <SectionHeading title="Recently verified" aside={<MoreLink href="/properties">Browse all properties</MoreLink>} />
        {recent.items.length > 0 ? (
          <PropertyGrid listings={recent.items.slice(0, 6)} priorityCount={featured.length ? 0 : 3} />
        ) : (
          <EmptyState icon={Building2} title="The first listings are in review"
            description="Verified properties appear here as soon as our team approves them."
            action={{ href: "/dashboard/properties/new", label: "Post a property" }} />
        )}
      </section>

      <section className="border-t bg-card/60">
        <div className="wrap grid gap-12 py-20 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-4">
            <p className="eyebrow">Locations</p>
            <h2 className="font-display text-4xl leading-tight md:text-5xl">Where in Coorg?</h2>
            <p className="max-w-sm text-muted-foreground">From Madikeri&rsquo;s hills to the plantation belts around Virajpet and Somwarpet.</p>
            <MoreLink href="/locations">All locations</MoreLink>
          </div>
          <ol className="grid border-t md:grid-cols-2 md:gap-x-10">
            {towns.map((l, i) => (
              <li key={l.id} className="border-b">
                <Link href={`/locations/${l.slug}`} className="group flex items-baseline gap-4 py-4">
                  <span className="w-6 text-xs tabular-nums text-subtle">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-xl font-medium tracking-tight transition-colors group-hover:text-primary">{l.name}</span>
                  {counts[l.id] ? <span className="text-sm text-muted-foreground">{counts[l.id]} {counts[l.id] === 1 ? "listing" : "listings"}</span> : null}
                  <ArrowUpRight className="size-4 -translate-x-1 self-center text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t">
        <div className="wrap py-20">
          <SectionHeading title="Browse by property type" aside={<MoreLink href="/property-types">All types</MoreLink>} />
          <ul className="grid border-l border-t sm:grid-cols-2 lg:grid-cols-4" role="list">
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <li key={value} className="border-b border-r">
                <Link href={`/properties?type=${toSlug(value)}`} className="group flex h-full flex-col gap-3 p-6 transition-colors hover:bg-card">
                  <span className="text-xl font-medium tracking-tight">{label}</span>
                  <span className="text-sm text-muted-foreground">{PROPERTY_TYPE_BLURBS[value]}</span>
                  <ArrowRight className="mt-auto size-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {articles.length > 0 && (
        <section className="border-t">
          <div className="wrap py-20">
            <SectionHeading title="Before you buy" aside={<MoreLink href="/guides">All guides</MoreLink>} />
            <ul className="grid gap-10 md:grid-cols-3" role="list">
              {articles.map((a) => (
                <li key={a.id} className="space-y-3 border-t pt-5">
                  <p className="text-xs text-muted-foreground">{formatDate(a.published_at)}</p>
                  <h3 className="text-xl font-medium leading-snug"><Link href={`/guides/${a.slug}`} className="hover:text-primary">{a.title}</Link></h3>
                  {a.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{a.excerpt}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="border-t bg-primary text-primary-foreground">
        <div className="wrap grid gap-12 py-20 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">For owners and agents</p>
            <h2 className="font-display text-4xl leading-tight text-balance md:text-5xl">Selling land in Coorg? List it free and get it verified.</h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-background text-foreground hover:bg-white">
                <Link href="/dashboard/properties/new">Post a property <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                <Link href="/verification">How verification works</Link>
              </Button>
            </div>
          </div>
          <ol className="divide-y divide-white/15 border-y border-white/15">
            {SELL_STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3rem_1fr] py-5">
                <span className="text-2xl font-light text-white/50">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-white/70">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary">
      <span className="underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary">{children}</span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
