import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TypeIcon } from "@/components/property/type-icon";
import { PageIntro } from "@/components/site/page-intro";
import { PROPERTY_TYPE_BLURBS, PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
import { getPropertyTypeImage } from "@/lib/property-types";

export const metadata: Metadata = {
  title: "Property types",
  description: "Coffee estates, agricultural and farm land, plots, homes and homestays across Coorg.",
  alternates: { canonical: "/property-types" },
};

export default function PropertyTypesPage() {
  return (
    <div className="wrap py-12">
      <PageIntro title="Property types" lede="From working coffee estates to plots near town." />
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => {
          const img = getPropertyTypeImage(value);
          return (
            <li key={value}>
              <Link
                href={`/properties?type=${toSlug(value)}`}
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
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur-xs shadow-xs">
                    <TypeIcon type={value} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="space-y-1.5">
                    <h2 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {label}
                    </h2>
                    <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                      {PROPERTY_TYPE_BLURBS[value]}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                    <span>Browse listings</span>
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
