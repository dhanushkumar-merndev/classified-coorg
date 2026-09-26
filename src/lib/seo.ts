// Structured data helpers. JSON-LD is serialized with `<` escaped so listing
// text can never close the script tag (SEO-008, XSS).

import { siteUrl } from "@/lib/site";

const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");

export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, "") };
}

export function breadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Land in Coorg",
    alternateName: ["LandInCoorg", "Coorg Land Marketplace", "Kodagu Real Estate"],
    url: siteUrl("/"),
    description: "Verified local property marketplace for coffee estates, farmland, plots and homes in Coorg (Kodagu).",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl("/properties")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Land in Coorg",
    url: siteUrl("/"),
    logo: siteUrl("/icon-512.png"),
    image: siteUrl("/images/hero-coorg-landscape.webp"),
    description: "The trusted marketplace for verified coffee estates, farmland, plots and bungalows in Coorg (Kodagu), Karnataka.",
    telephone: "+91-9036215854",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Madikeri",
      addressRegion: "Karnataka",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 12.4244,
      longitude: 75.7382,
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Kodagu District" },
      { "@type": "City", name: "Madikeri" },
      { "@type": "City", name: "Kushalnagar" },
      { "@type": "City", name: "Virajpet" },
      { "@type": "City", name: "Somwarpet" },
      { "@type": "City", name: "Gonikoppal" },
      { "@type": "City", name: "Suntikoppa" },
      { "@type": "City", name: "Boikere" },
      { "@type": "City", name: "Napoklu" },
    ],
    priceRange: "₹₹ - ₹₹₹₹",
  };
}

export function faqLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

export function itemListLd(items: Array<{ name: string; url: string; image?: string; description?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.image ? { image: item.image } : {}),
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}

export function placeLd(place: {
  name: string;
  description?: string;
  url: string;
  image?: string;
  containedInPlace?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: place.name,
    description: place.description,
    url: place.url,
    ...(place.image ? { image: place.image } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: place.name,
      addressRegion: "Karnataka",
      addressCountry: "IN",
    },
    ...(place.containedInPlace
      ? {
          containedInPlace: {
            "@type": "AdministrativeArea",
            name: place.containedInPlace,
          },
        }
      : {}),
  };
}

export function truncate(text: string | null | undefined, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

