import type { Metadata } from "next";
import Link from "next/link";
import { TypeIcon } from "@/components/property/type-icon";
import { PageIntro } from "@/components/site/page-intro";
import { PROPERTY_TYPE_BLURBS, PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Property types",
  description: "Coffee estates, agricultural and farm land, plots, homes and homestays across Coorg.",
  alternates: { canonical: "/property-types" },
};

export default function PropertyTypesPage() {
  return (
    <div className="wrap py-12">
      <PageIntro title="Property types" lede="From working coffee estates to plots near town." />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
          <li key={value}>
            <Link href={`/properties?type=${toSlug(value)}`}
              className="group flex h-full flex-col gap-3 rounded-md border bg-card p-5 transition-colors hover:border-primary">
              <TypeIcon type={value} />
              <span className="font-semibold group-hover:text-primary">{label}</span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{PROPERTY_TYPE_BLURBS[value]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
