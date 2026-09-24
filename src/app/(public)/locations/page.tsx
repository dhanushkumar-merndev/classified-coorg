import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { getLocationCounts, getLocations } from "@/repositories/public-listings";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Locations in Coorg",
  description: "Browse verified land, estates and plots by town and area across Coorg (Kodagu).",
  alternates: { canonical: "/locations" },
};

export default async function LocationsPage() {
  const [locations, counts] = await Promise.all([getLocations(), getLocationCounts()]);
  const towns = locations.filter((l) => l.parent_id !== null);
  return (
    <div className="wrap py-12 md:py-16">
      <PageIntro eyebrow="Locations" title="Towns and areas across Coorg" lede="Choose a town to see the verified listings there." />
      <ol className="mt-10 grid border-t md:grid-cols-2 md:gap-x-12">
        {towns.map((l, i) => (
          <li key={l.id} className="border-b">
            <Link href={`/locations/${l.slug}`} className="group flex items-baseline gap-5 py-5">
              <span className="w-6 text-xs tabular-nums text-subtle">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 text-2xl font-medium tracking-tight transition-colors group-hover:text-primary">{l.name}</span>
              {counts[l.id] ? <span className="text-sm text-muted-foreground">{counts[l.id]} verified {counts[l.id] === 1 ? "listing" : "listings"}</span> : null}
              <ArrowUpRight className="size-4 self-center text-primary opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
