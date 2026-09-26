import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TypeIcon } from "@/components/property/type-icon";
import { GridColumnsList, GridColumnsProvider, GridColumnsSelect } from "@/components/property/grid-columns";
import { PageIntro } from "@/components/site/page-intro";
import { PROPERTY_TYPE_BLURBS, PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
import { breadcrumbLd, itemListLd, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { getPropertyTypeImage } from "@/lib/property-types";

export const metadata: Metadata = {
  title: "Property Types in Coorg | Coffee Estates, Farmland, Plots & Homestays",
  description:
    "Browse verified listings by property category across Coorg (Kodagu): Coffee Estates, Agricultural Land, Farm Land, Residential Plots, Commercial Land, Houses & Homestays.",
  keywords: [
    "Coorg property types",
    "coffee estates Coorg",
    "agricultural land Kodagu",
    "farmland in Coorg",
    "residential plots Madikeri",
    "commercial land Coorg",
    "resorts homestays for sale Coorg",
    "buy plantation Coorg",
    "Kodagu real estate categories",
  ],
  alternates: { canonical: "/property-types" },
  openGraph: {
    title: "Property Types in Coorg | Coffee Estates, Farmland, Plots & Homestays",
    description:
      "Browse verified listings by property category across Coorg (Kodagu): Coffee Estates, Agricultural Land, Farm Land, Residential Plots, Commercial Land, and Homestays.",
    url: siteUrl("/property-types"),
    siteName: "Land in Coorg",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: siteUrl("/images/property-types/coffee-estate.webp"),
        width: 1200,
        height: 630,
        alt: "Coffee estates and properties in Coorg, Karnataka",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Property Types in Coorg | Coffee Estates, Farmland, Plots & Homestays",
    description:
      "Browse verified listings by property category across Coorg (Kodagu): Coffee Estates, Farmland, Plots & Homestays.",
    images: [siteUrl("/images/property-types/coffee-estate.webp")],
  },
};

export default function PropertyTypesPage() {
  return (
    <div className="wrap py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbLd([
          { name: "Home", url: siteUrl("/") },
          { name: "Property Types", url: siteUrl("/property-types") },
        ]))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(itemListLd(
          Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
            name: `${label} for Sale in Coorg`,
            url: siteUrl(`/properties?type=${toSlug(value)}`),
            image: siteUrl(getPropertyTypeImage(value).src),
            description: PROPERTY_TYPE_BLURBS[value],
          }))
        ))}
      />
      <GridColumnsProvider scope="types">
      <PageIntro title="Property types" lede="From working coffee estates to plots near town." actions={<GridColumnsSelect />} />
      <GridColumnsList className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
      </GridColumnsList>
      </GridColumnsProvider>
    </div>
  );
}
