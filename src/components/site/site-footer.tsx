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
      <div className="wrap grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Verified land and estates across Coorg.</p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} prefetch={l.href.startsWith("/dashboard") ? false : undefined} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="wrap flex flex-col gap-1 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Land in Coorg</p>
          <p>Buyers should complete independent legal verification before purchase.</p>
        </div>
      </div>
    </footer>
  );
}
