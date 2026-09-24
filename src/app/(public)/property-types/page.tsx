import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { PROPERTY_TYPE_BLURBS, PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Property types",
  description: "Coffee estates, agricultural and farm land, plots, homes and homestays across Coorg.",
  alternates: { canonical: "/property-types" },
};

export default function PropertyTypesPage() {
  return (
    <div className="wrap py-12 md:py-16">
      <PageIntro eyebrow="Property types" title="What's for sale in Coorg" lede="From working coffee estates to plots near town. Pick a type to see verified listings." />
      <ul className="mt-10 grid border-l border-t sm:grid-cols-2 lg:grid-cols-4" role="list">
        {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
          <li key={value} className="border-b border-r">
            <Link href={`/properties?type=${toSlug(value)}`} className="group flex h-full min-h-48 flex-col gap-3 p-6 transition-colors hover:bg-card">
              <span className="text-xl font-medium tracking-tight">{label}</span>
              <span className="text-sm text-muted-foreground">{PROPERTY_TYPE_BLURBS[value]}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                View listings <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
