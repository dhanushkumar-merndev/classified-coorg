import Link from "next/link";
import { MapPin } from "lucide-react";
import { VerifiedBadge } from "@/components/property/badges";
import { PropertyImage } from "@/components/property/property-image";
import { SaveButton } from "@/components/property/save-button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArea, formatPricePerUnit, formatPriceShort, formatRelative } from "@/lib/format";
import { PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS } from "@/lib/labels";
import { mediaUrl, propertyPath } from "@/lib/site";
import type { ListingCard } from "@/repositories/public-listings";

// design.md §11 order: image, badge, title, location, price, area, price per
// unit, seller type, posted date, save, view CTA. Public cards are always
// verified listings (the public predicate).
export function PropertyCard({ listing, priority = false }: { listing: ListingCard; priority?: boolean }) {
  const perUnit = formatPricePerUnit(listing.price_per_unit, listing.area_unit);
  return (
    <Card className="group relative gap-0 overflow-hidden rounded-xl p-0 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-muted">
        <PropertyImage
          src={listing.coverId ? mediaUrl(listing.coverId, "thumb") : null}
          alt={listing.coverAlt ?? listing.title}
          priority={priority}
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <VerifiedBadge />
        </div>
        <div className="absolute right-3 top-3 z-10">
          <SaveButton propertyId={listing.id} title={listing.title} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-medium text-muted-foreground">{PROPERTY_TYPE_LABELS[listing.property_type] ?? "Property"}</p>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link href={propertyPath(listing.slug)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {listing.title}
          </Link>
        </h3>
        {listing.location && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" /> {listing.location.name}, Coorg
          </p>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-xl font-semibold tracking-tight">{formatPriceShort(listing.price)}</p>
          <p className="text-sm text-muted-foreground">{formatArea(listing.area_value, listing.area_unit)}</p>
        </div>
        {perUnit && <p className="text-xs text-muted-foreground">{perUnit}</p>}
        <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>{SELLER_TYPE_LABELS[listing.seller_type] ?? "Seller"}</span>
          <span>Posted {formatRelative(listing.published_at)}</span>
        </div>
      </div>
    </Card>
  );
}

export function PropertyCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden rounded-xl p-0">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </Card>
  );
}

export function PropertyGrid({ listings, priorityCount = 0 }: { listings: ListingCard[]; priorityCount?: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
      {listings.map((listing, i) => (
        <li key={listing.id} className="flex">
          <div className="w-full [&>*]:h-full"><PropertyCard listing={listing} priority={i < priorityCount} /></div>
        </li>
      ))}
    </ul>
  );
}
