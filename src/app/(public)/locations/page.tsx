import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { getLocationImage } from "@/lib/locations";
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
      <PageIntro title="Locations" lede="Pick a town to see its verified listings across Coorg." />
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {towns.map((l) => {
          const img = getLocationImage(l.slug);
          const count = counts[l.id] ?? 0;
          return (
            <li key={l.id}>
              <Link
                href={`/locations/${l.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:border-primary hover:shadow-md"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted select-none">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur-xs shadow-xs">
                    <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                    <span>{count} {count === 1 ? "listing" : "listings"}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {l.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Explore verified properties in {l.name}, Kodagu
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                    <span>View listings</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
