import Link from "next/link";
import { Logo } from "@/components/site/logo";

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
    <footer className="mt-auto border-t bg-muted/60">
      <div className="wrap grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Land, coffee estates and homes across Kodagu, each one reviewed by our team before it is published.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-4">
            <h2 className="eyebrow">{col.title}</h2>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-foreground/80 hover:text-foreground hover:underline hover:underline-offset-4">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="wrap py-6 text-xs leading-relaxed text-muted-foreground">
          © {new Date().getFullYear()} Land in Coorg. Listing information is reviewed by the platform; buyers should complete
          independent legal verification before purchase.
        </p>
      </div>
    </footer>
  );
}
