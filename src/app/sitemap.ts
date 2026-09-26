import type { MetadataRoute } from "next";
import { PROPERTY_TYPE_LABELS, toSlug } from "@/lib/labels";
import { propertyPath, siteUrl } from "@/lib/site";
import { getListingSlugsForSitemap, getLocations, getPublishedArticles } from "@/repositories/public-listings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [locations, listings, articles] = await Promise.all([
    getLocations(), getListingSlugsForSitemap(0, 5000), getPublishedArticles(200),
  ]);

  const coreRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1.0 },
    { url: siteUrl("/properties"), changeFrequency: "daily", priority: 0.95 },
    { url: siteUrl("/locations"), changeFrequency: "weekly", priority: 0.9 },
    { url: siteUrl("/property-types"), changeFrequency: "weekly", priority: 0.9 },
    { url: siteUrl("/guides"), changeFrequency: "weekly", priority: 0.9 },
    { url: siteUrl("/verification"), changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/disclaimer"), changeFrequency: "monthly", priority: 0.4 },
  ];

  const typeRoutes: MetadataRoute.Sitemap = Object.keys(PROPERTY_TYPE_LABELS).map((val) => ({
    url: siteUrl(`/properties?type=${toSlug(val)}`),
    changeFrequency: "daily",
    priority: 0.85,
  }));

  const locationRoutes: MetadataRoute.Sitemap = locations
    .filter((l) => l.type !== "district")
    .map((l) => ({
      url: siteUrl(`/locations/${l.slug}`),
      changeFrequency: "weekly",
      priority: 0.85,
    }));

  const listingRoutes: MetadataRoute.Sitemap = listings.map((l) => ({
    url: siteUrl(propertyPath(l.slug)),
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: siteUrl(`/guides/${a.slug}`),
    lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    ...coreRoutes,
    ...typeRoutes,
    ...locationRoutes,
    ...listingRoutes,
    ...articleRoutes,
  ];
}
