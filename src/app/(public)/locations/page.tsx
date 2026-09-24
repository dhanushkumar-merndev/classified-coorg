import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Locations in Coorg</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Choose a town or area to see verified listings there.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {towns.map((l) => (
          <li key={l.id}>
            <Link href={`/locations/${l.slug}`} className="flex h-full flex-col gap-2 rounded-xl border bg-card p-6 hover:border-primary">
              <span className="flex items-center gap-2 text-lg font-semibold"><MapPin className="size-5 text-primary" aria-hidden="true" /> {l.name}</span>
              <span className="text-sm text-muted-foreground">{counts[l.id] ?? 0} verified {counts[l.id] === 1 ? "listing" : "listings"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
