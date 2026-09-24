import Link from "next/link";
import { VerifiedBadge } from "@/components/property/badges";
import { PropertyImage } from "@/components/property/property-image";
import { SaveButton } from "@/components/property/save-button";
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
    <article className="group relative flex flex-col gap-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        <PropertyImage
          src={listing.coverId ? mediaUrl(listing.coverId, "thumb") : null}
          alt={listing.coverAlt ?? listing.title}
          priority={priority}
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3"><VerifiedBadge /></div>
        <div className="absolute right-3 top-3 z-10"><SaveButton propertyId={listing.id} title={listing.title} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {PROPERTY_TYPE_LABELS[listing.property_type] ?? "Property"}
          {listing.location && <> · {listing.location.name}</>}
        </p>
        <h3 className="line-clamp-2 text-[1.05rem] font-medium leading-snug">
          <Link href={propertyPath(listing.slug)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:underline group-hover:underline-offset-4">
            {listing.title}
          </Link>
        </h3>
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-3">
          <p className="text-2xl font-medium tracking-tight leading-none">{formatPriceShort(listing.price)}</p>
          <p className="text-sm text-muted-foreground">{formatArea(listing.area_value, listing.area_unit)}</p>
        </div>
        <p className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>{perUnit ?? SELLER_TYPE_LABELS[listing.seller_type] ?? "Seller"}</span>
          <span>{formatRelative(listing.published_at)}</span>
        </p>
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="aspect-[4/3] rounded-md" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-7 w-1/3" />
      </div>
    </div>
  );
}

export function PropertyGrid({ listings, priorityCount = 0 }: { listings: ListingCard[]; priorityCount?: number }) {
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" role="list">
      {listings.map((listing, i) => (
        <li key={listing.id} className="flex"><PropertyCard listing={listing} priority={i < priorityCount} /></li>
      ))}
    </ul>
  );
}
