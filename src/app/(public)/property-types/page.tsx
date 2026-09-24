import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Property types",
  description: "Coffee estates, agricultural and farm land, plots, homes and homestays across Coorg.",
  alternates: { canonical: "/property-types" },
};

export default function PropertyTypesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Property types</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
          <li key={value}>
            <Link href={`/properties?type=${toSlug(value)}`} className="flex h-full items-center justify-between rounded-xl border bg-card p-6 font-medium hover:border-primary">
              {label} <ArrowRight className="size-4 text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
