import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
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
    <div className="wrap py-12">
      <PageIntro title="Locations" lede="Pick a town to see its verified listings." />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {towns.map((l) => (
          <li key={l.id}>
            <Link href={`/locations/${l.slug}`}
              className="group flex items-center gap-3 rounded-md border bg-card p-4 transition-colors hover:border-primary">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium group-hover:text-primary">{l.name}</span>
                <span className="text-sm text-muted-foreground">{counts[l.id] ?? 0} {counts[l.id] === 1 ? "listing" : "listings"}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
