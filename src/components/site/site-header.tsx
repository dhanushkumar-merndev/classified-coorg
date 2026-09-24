"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, Plus, Search } from "lucide-react";
import { useState } from "react";
import { AccountMenu } from "@/components/site/account-menu";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// design.md §9: sticky, white, thin border; Buy · Locations · Property Types ·
// Guides · Post Property · Saved · Account. Mobile: logo, search, account, menu.

const NAV = [
  { href: "/properties", label: "Buy" },
  { href: "/locations", label: "Locations" },
  { href: "/property-types", label: "Property types" },
  { href: "/guides", label: "Guides" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(item.href) && "bg-accent text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="lg:hidden" aria-label="Search properties">
            <Link href="/properties"><Search /></Link>
          </Button>
          <Button asChild variant="ghost" className="hidden lg:inline-flex">
            <Link href="/dashboard/saved"><Heart /> Saved</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/dashboard/properties/new"><Plus /> Post property</Link>
          </Button>
          <AccountMenu />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4" onClick={() => setOpen(false)}>
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">
                    {item.label}
                  </Link>
                ))}
                <Link href="/dashboard/saved" className="rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">Saved</Link>
                <Separator className="my-2" />
                <Button asChild size="lg"><Link href="/dashboard/properties/new"><Plus /> Post property</Link></Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
