import type { MetadataRoute } from "next";
import { propertyPath, siteUrl } from "@/lib/site";
import { getListingSlugsForSitemap, getLocations, getPublishedArticles } from "@/repositories/public-listings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [locations, listings, articles] = await Promise.all([
    getLocations(), getListingSlugsForSitemap(0, 5000), getPublishedArticles(200),
  ]);
  const fixed = ["", "/properties", "/locations", "/property-types", "/guides", "/verification", "/disclaimer"];
  return [
    ...fixed.map((p) => ({ url: siteUrl(p) })),
    ...locations.filter((l) => l.type !== "district").map((l) => ({ url: siteUrl(`/locations/${l.slug}`) })),
    ...listings.map((l) => ({ url: siteUrl(propertyPath(l.slug)), lastModified: l.updated_at })),
    ...articles.map((a) => ({ url: siteUrl(`/guides/${a.slug}`) })),
  ];
}
