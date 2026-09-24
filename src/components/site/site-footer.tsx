import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { SITE_TAGLINE } from "@/lib/site";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/properties", label: "All properties" },
      { href: "/properties?type=coffee-estate", label: "Coffee estates" },
      { href: "/properties?type=farm-land", label: "Farm land" },
      { href: "/locations", label: "Locations" },
    ],
  },
  {
    title: "Sell",
    links: [
      { href: "/dashboard/properties/new", label: "Post a property" },
      { href: "/dashboard/properties", label: "My listings" },
      { href: "/guides", label: "Guides" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/verification", label: "How verification works" },
      { href: "/disclaimer", label: "Property disclaimer" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-secondary text-secondary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="space-y-3">
          <Logo inverted />
          <p className="max-w-xs text-sm text-white/70">{SITE_TAGLINE}.</p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-semibold text-white">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/70 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/60 sm:px-6">
          © {new Date().getFullYear()} Land in Coorg. Listing information is reviewed by the platform; buyers should complete
          independent legal verification before purchase.
        </p>
      </div>
    </footer>
  );
}
