// Structured data helpers. JSON-LD is serialized with `<` escaped so listing
// text can never close the script tag (SEO-008, XSS).

const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");

export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, "") };
}

export function breadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

export function truncate(text: string | null | undefined, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
