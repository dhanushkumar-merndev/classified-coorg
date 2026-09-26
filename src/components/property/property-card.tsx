"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { VerifiedBadge } from "@/components/property/badges";
import { type GridColumns, useGridColumns, wideColumnsClass } from "@/components/property/grid-columns";
import { PropertyImage } from "@/components/property/property-image";
import { SaveButton } from "@/components/property/save-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArea, formatPricePerUnit, formatPriceShort, formatRelative } from "@/lib/format";
import { PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS } from "@/lib/labels";
import { mediaUrl, propertyPath } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { ListingCard } from "@/repositories/public-listings";

// design.md §11 content, trimmed for scanning: image with verified badge and
// save, one-line title, location and area, price. Public cards are always
// verified listings (the public predicate).
export function PropertyCard({ listing, priority = false }: { listing: ListingCard; priority?: boolean }) {
  const perUnit = formatPricePerUnit(listing.price_per_unit, listing.area_unit);
  const type = PROPERTY_TYPE_LABELS[listing.property_type] ?? "Property";
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-md border bg-card transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(20,26,22,.18)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <PropertyImage
          src={listing.coverId ? mediaUrl(listing.coverId, "thumb") : null}
          alt={listing.coverAlt ?? listing.title}
          priority={priority}
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3"><VerifiedBadge /></div>
        {listing.hasVideo && (
          <Link
            href={`${propertyPath(listing.slug)}#video-tour`}
            aria-label={`Watch video: ${listing.title}`}
            className="absolute bottom-3 left-3 z-10 inline-flex min-h-11 items-center gap-2 rounded-md bg-black/75 px-3 text-sm font-medium text-white hover:bg-black/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Play className="size-4" aria-hidden="true" /> Watch video
          </Link>
        )}
        <div className="absolute right-3 top-3 z-10"><SaveButton propertyId={listing.id} title={listing.title} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xl font-semibold tracking-tight">{formatPriceShort(listing.price)}</p>
        <h3 className="truncate text-[0.95rem] font-medium" title={listing.title}>
          <Link href={propertyPath(listing.slug)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {listing.title}
          </Link>
        </h3>
        <p className="truncate text-sm text-muted-foreground">
          {[type, listing.location?.name, formatArea(listing.area_value, listing.area_unit)].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 flex justify-between gap-3 text-xs text-subtle">
          <span>{perUnit ?? SELLER_TYPE_LABELS[listing.seller_type] ?? "Seller"}</span>
          <span>{formatRelative(listing.published_at)}</span>
        </p>
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}

export function PropertyGrid({
  listings,
  priorityCount = 0,
  collapsibleOnMobile = false,
  columns = 4,
}: {
  listings: ListingCard[];
  priorityCount?: number;
  collapsibleOnMobile?: boolean;
  /** Cards per row on the widest screens; 5 for full result lists. */
  columns?: GridColumns;
}) {
  const [expanded, setExpanded] = useState(false);
  // Inside a result list with a 4/5 switch, the viewer's choice wins.
  const perRow = useGridColumns() ?? columns;
  const hasMore = collapsibleOnMobile && listings.length > 4;

  return (
    <div className="space-y-4">
      <ul className={cn("grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", perRow > 4 && "gap-4", wideColumnsClass(perRow))} role="list">
        {listings.map((listing, i) => (
          <li
            key={listing.id}
            className={cn(
              "flex",
              hasMore && !expanded && i >= 4 && "hidden sm:flex"
            )}
          >
            <PropertyCard listing={listing} priority={i < priorityCount} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="sm:hidden pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-primary/20 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 active:scale-[0.99]"
          >
            <span>{expanded ? "Show less" : `See more (${listings.length - 4} more)`}</span>
            {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      )}
    </div>
  );
}
