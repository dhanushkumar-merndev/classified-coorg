import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/images/"],
        disallow: ["/dashboard", "/admin", "/api/", "/login"],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/images/"],
        disallow: ["/dashboard", "/admin", "/api/", "/login"],
      },
      {
        userAgent: "Bingbot",
        allow: ["/", "/images/"],
        disallow: ["/dashboard", "/admin", "/api/", "/login"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}

