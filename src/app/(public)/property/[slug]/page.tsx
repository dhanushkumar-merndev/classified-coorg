import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Calendar, Check, Droplets, IndianRupee, LandPlot, MapPin, Route, Ruler, ShieldCheck, Tag, UserRound, Zap } from "lucide-react";
import { VerifiedBadge } from "@/components/property/badges";
import { ContactOwner } from "@/components/property/contact-owner";
import { Gallery } from "@/components/property/gallery";
import { PropertyGrid } from "@/components/property/property-card";
import { VideoTour } from "@/components/property/video-tour";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatArea, formatDate, formatPriceFull, formatPricePerUnit, formatPriceShort } from "@/lib/format";
import {
  LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS, VERIFIED_DISCLAIMER,
} from "@/lib/labels";
import { detailValues, selectedAmenities, selectedFeatures } from "@/lib/listing/details";
import { breadcrumbLd, jsonLd, truncate } from "@/lib/seo";
import { mediaUrl, propertyPath, siteUrl, videoUrl } from "@/lib/site";
import { getListingBySlug, getSimilarListings, type ListingDetail } from "@/repositories/public-listings";

export const revalidate = 300;

export async function generateStaticParams() {
  // Rendered on first request, then cached and revalidated by tag.
  return [];
}

async function load(slug: string): Promise<ListingDetail> {
  const result = await getListingBySlug(slug);
  if (result.kind === "redirect") permanentRedirect(propertyPath(result.slug));
  if (result.kind === "missing") notFound();
  return result.listing;
}

export async function generateMetadata({ params }: PageProps<"/property/[slug]">): Promise<Metadata> {
  const result = await getListingBySlug((await params).slug);
  if (result.kind !== "found") return { title: "Property not found", robots: { index: false } };
  const l = result.listing;
  const cover = l.media.find((m) => m.is_cover) ?? l.media[0];
  const title = `${l.title} — ${formatPriceShort(l.price)}`;
  const description = truncate(
    `${PROPERTY_TYPE_LABELS[l.property_type]} of ${formatArea(l.area_value, l.area_unit)} in ${l.location?.name ?? "Coorg"}. ${l.description ?? ""}`,
    160,
  );
  return {
    title,
    description,
    alternates: { canonical: propertyPath(l.slug) },
    openGraph: {
      type: "article",
      title,
      description,
      url: propertyPath(l.slug),
      images: cover ? [{ url: mediaUrl(cover.id), width: cover.width, height: cover.height, alt: cover.alt_text ?? l.title }] : undefined,
    },
  };
}

export default async function PropertyPage({ params }: PageProps<"/property/[slug]">) {
  const listing = await load((await params).slug);
  const similar = await getSimilarListings(listing.id, listing.location?.id ?? null, listing.property_type);
  const perUnit = formatPricePerUnit(listing.price_per_unit, listing.area_unit);
  const images = listing.media.map((m, i) => ({ id: m.id, alt: m.alt_text ?? `${listing.title} — photo ${i + 1}` }));
  const video = listing.video?.[0] ?? null;
  const locationName = listing.location?.name ?? "Coorg";
  const url = siteUrl(propertyPath(listing.slug));

  const structured = [
    breadcrumbLd([
      { name: "Home", url: siteUrl("/") },
      { name: "Properties", url: siteUrl("/properties") },
      ...(listing.location ? [{ name: listing.location.name, url: siteUrl(`/locations/${listing.location.slug}`) }] : []),
      { name: listing.title, url },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: listing.title,
      url,
      description: truncate(listing.description, 500),
      datePosted: listing.published_at,
      image: images.slice(0, 5).map((img) => siteUrl(mediaUrl(img.id))),
      offers: { "@type": "Offer", price: Number(listing.price), priceCurrency: "INR", availability: "https://schema.org/InStock" },
      contentLocation: { "@type": "Place", name: `${locationName}, Kodagu, Karnataka, India` },
    },
  ];

  // Broker model: the public sees the town, never the seller's name, contact
  // details or exact address. Buyers enquire through Land in Coorg.
  const facts = [
    { icon: Ruler, label: "Area", value: formatArea(listing.area_value, listing.area_unit) },
    ...(perUnit ? [{ icon: IndianRupee, label: "Price per unit", value: perUnit }] : []),
    { icon: LandPlot, label: "Property type", value: PROPERTY_TYPE_LABELS[listing.property_type] ?? "Property" },
    { icon: Tag, label: "Listing", value: LISTING_TYPE_LABELS[listing.listing_type] ?? "For sale" },
    { icon: UserRound, label: "Listed by", value: SELLER_TYPE_LABELS[listing.seller_type] ?? "Seller" },
  ];

  const details = detailValues(listing.features);
  const amenities = selectedAmenities(listing, details);
  const features = selectedFeatures(details);
  const amenityIcons: Record<string, typeof Check> = { road_access: Route, water_available: Droplets, electricity_available: Zap };


  return (
    <article className="wrap pb-28 pt-6 lg:pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/properties">Properties</BreadcrumbLink></BreadcrumbItem>
          {listing.location && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href={`/locations/${listing.location.slug}`}>{listing.location.name}</BreadcrumbLink></BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage className="line-clamp-1 max-w-48">{listing.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <VerifiedBadge />
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {PROPERTY_TYPE_LABELS[listing.property_type]}
            </span>
          </div>
          <h1 className="font-display text-2xl leading-tight text-balance md:text-3xl">{listing.title}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" /> {locationName} area, Coorg
          </p>
        </div>
        <div className="shrink-0 md:text-right">
          <p className="text-3xl font-semibold tracking-tight">{formatPriceShort(listing.price)}</p>
          <p className="text-sm text-muted-foreground">
            {[perUnit, listing.negotiable ? "Negotiable" : null].filter(Boolean).join(" · ") || formatPriceFull(listing.price)}
          </p>
        </div>
      </header>

      <div className="mt-6"><Gallery images={images} title={listing.title} /></div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-10">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1 rounded-md border bg-card p-4">
                <dt className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <f.icon className="size-4 text-primary" aria-hidden="true" /> {f.label}
                </dt>
                <dd className="font-semibold leading-snug">{f.value}</dd>
              </div>
            ))}
          </dl>

          {listing.description && (
            <Section id="about" title="About this property">
              <p className="whitespace-pre-line leading-7 text-foreground/90">{listing.description}</p>
            </Section>
          )}

          {amenities.length > 0 && (
            <Section id="amenities" title="Amenities">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {amenities.map((amenity) => {
                  const Icon = amenityIcons[amenity.key] ?? Check;
                  return (
                    <li key={amenity.key} className="flex items-center gap-3 rounded-md border bg-card p-3.5 text-sm">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                      <span className="font-medium">{amenity.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {features.length > 0 && (
            <Section id="features" title="Features">
              <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {features.map((feature) => (
                  <li key={feature.key} className="flex min-w-0 items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="wrap-anywhere">
                      {feature.label}{feature.kind === "text" ? `: ${details[feature.key]}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {video && (
            <Section id="video-tour" title="Video tour">
              <VideoTour
                title={listing.title}
                src={videoUrl(video.id)}
                posterUrl={videoUrl(video.id, "poster.jpg")}
                durationSeconds={Number(video.duration_seconds)}
                shortSide={Math.min(video.width, video.height)}
              />
            </Section>
          )}

          <Section id="location" title="Approximate location">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4">
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {locationName} area, Kodagu, Karnataka
              </p>
              {listing.location && (
                <Link href={`/locations/${listing.location.slug}`} className="text-sm font-medium text-primary hover:underline">
                  More in {listing.location.name}
                </Link>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Only the general area is shown. Contact Land in Coorg to arrange a site visit; our team will share the exact location and directions.</p>
          </Section>

          <Alert>
            <ShieldCheck />
            <AlertTitle>About verification</AlertTitle>
            <AlertDescription>
              {VERIFIED_DISCLAIMER} <Link href="/verification" className="underline">How verification works</Link>.
            </AlertDescription>
          </Alert>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" /> Published {formatDate(listing.published_at)} · Updated {formatDate(listing.updated_at)}
          </p>
        </div>

        <aside aria-label="Enquire" className="lg:sticky lg:top-20">
          <ContactOwner propertyId={listing.id} title={listing.title} priceLabel={formatPriceShort(listing.price)} />
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-16 space-y-5">
          <h2 id="similar-heading" className="font-display text-2xl">Similar properties</h2>
          <PropertyGrid listings={similar} />
        </section>
      )}
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4">
      <h2 id={`${id}-heading`} className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
