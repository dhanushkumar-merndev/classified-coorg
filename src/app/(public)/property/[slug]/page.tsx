import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Calendar, Check, Droplets, MapPin, Route, ShieldCheck, UserRound, X, Zap } from "lucide-react";
import { VerifiedBadge } from "@/components/property/badges";
import { ContactOwner } from "@/components/property/contact-owner";
import { Gallery } from "@/components/property/gallery";
import { PropertyGrid } from "@/components/property/property-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { formatArea, formatDate, formatPriceFull, formatPricePerUnit, formatPriceShort } from "@/lib/format";
import {
  FEATURE_LABELS, LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS, VERIFIED_DISCLAIMER,
} from "@/lib/labels";
import { breadcrumbLd, jsonLd, truncate } from "@/lib/seo";
import { SITE_NAME, mediaUrl, propertyPath, siteUrl } from "@/lib/site";
import {
  getListingBySlug, getListingSeller, getSimilarListings, type ListingDetail,
} from "@/repositories/public-listings";

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
  const [seller, similar] = await Promise.all([
    getListingSeller(listing.id),
    getSimilarListings(listing.id, listing.location?.id ?? null, listing.property_type),
  ]);
  const perUnit = formatPricePerUnit(listing.price_per_unit, listing.area_unit);
  const images = listing.media.map((m, i) => ({ id: m.id, alt: m.alt_text ?? `${listing.title} — photo ${i + 1}` }));
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

  const facts: Array<{ label: string; value: string }> = [
    { label: "Property type", value: PROPERTY_TYPE_LABELS[listing.property_type] ?? "Property" },
    { label: "Area", value: formatArea(listing.area_value, listing.area_unit) },
    ...(perUnit ? [{ label: "Price per unit", value: perUnit }] : []),
    { label: "Listing", value: LISTING_TYPE_LABELS[listing.listing_type] ?? "For sale" },
    { label: "Posted by", value: SELLER_TYPE_LABELS[listing.seller_type] ?? "Seller" },
    { label: "Price", value: `${formatPriceFull(listing.price)}${listing.negotiable ? " (negotiable)" : ""}` },
  ];

  const amenities = [
    { icon: Route, label: "Road access", value: listing.road_access },
    { icon: Droplets, label: "Water available", value: listing.water_available },
    { icon: Zap, label: "Electricity", value: listing.electricity_available },
  ];

  return (
    <article className="wrap pb-28 pt-8 lg:pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <Breadcrumb className="mb-4">
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

      <Gallery images={images} title={listing.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge />
              <span className="text-sm text-muted-foreground">{PROPERTY_TYPE_LABELS[listing.property_type]}</span>
            </div>
            <h1 className="font-display text-3xl leading-[1.1] text-balance md:text-[2.75rem]">{listing.title}</h1>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" /> {listing.address_text ? `${listing.address_text}, ` : ""}{locationName}, Coorg
            </p>
            <p className="text-3xl font-semibold tracking-tight lg:hidden">{formatPriceShort(listing.price)}</p>
          </header>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y py-6 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{f.label}</dt>
                <dd className="mt-1.5 text-lg font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>

          {listing.description && (
            <section aria-labelledby="about-heading" className="space-y-3">
              <h2 id="about-heading" className="text-xl font-medium tracking-tight">About this property</h2>
              <p className="whitespace-pre-line leading-relaxed text-foreground/90">{listing.description}</p>
            </section>
          )}

          <section aria-labelledby="details-heading" className="space-y-3">
            <h2 id="details-heading" className="text-xl font-medium tracking-tight">Property details</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {amenities.map((a) => (
                <li key={a.label} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
                  <a.icon className="size-4 text-primary" aria-hidden="true" />
                  <span className="flex-1">{a.label}</span>
                  {a.value === true ? <Check className="size-4 text-success" aria-label="Yes" />
                    : a.value === false ? <X className="size-4 text-muted-foreground" aria-label="No" />
                    : <span className="text-xs text-muted-foreground">Not stated</span>}
                </li>
              ))}
            </ul>
          </section>

          {listing.features.length > 0 && (
            <section aria-labelledby="features-heading" className="space-y-3">
              <h2 id="features-heading" className="text-xl font-medium tracking-tight">Features</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {listing.features.map((f) => (
                  <li key={f.feature_key} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      {FEATURE_LABELS[f.feature_key] ?? f.feature_key.replace(/_/g, " ")}
                      {f.feature_value && f.feature_value !== "true" ? `: ${f.feature_value}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="location-heading" className="space-y-3">
            <h2 id="location-heading" className="text-xl font-medium tracking-tight">Location</h2>
            <p className="text-muted-foreground">
              {listing.address_text ? `${listing.address_text}, ` : ""}{locationName}, Kodagu district, Karnataka.
              {listing.location && <> <Link href={`/locations/${listing.location.slug}`} className="text-primary hover:underline">More properties in {listing.location.name}</Link></>}
            </p>
          </section>

          {seller && (
            <section aria-labelledby="seller-heading" className="flex items-center gap-4 rounded-xl border bg-card p-5">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary"><UserRound aria-hidden="true" /></div>
              <div>
                <h2 id="seller-heading" className="font-semibold">{seller.display_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {SELLER_TYPE_LABELS[seller.seller_type] ?? "Seller"} · on {SITE_NAME} since {seller.member_since}
                </p>
              </div>
            </section>
          )}

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

        <aside aria-label="Contact">
          <ContactOwner propertyId={listing.id} title={listing.title} priceLabel={formatPriceShort(listing.price)} />
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-16 space-y-6">
          <Separator />
          <h2 id="similar-heading" className="font-display text-3xl">Similar properties</h2>
          <PropertyGrid listings={similar} />
        </section>
      )}
    </article>
  );
}
