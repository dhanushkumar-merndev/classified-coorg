"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Clock, Heart, LayoutDashboard, MessageSquare, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, seller: false, exact: true },
  { href: "/dashboard/properties", label: "My properties", icon: Building2, seller: true },
  { href: "/dashboard/saved", label: "Saved properties", icon: Heart, seller: false },
  { href: "/dashboard/enquiries", label: "My enquiries", icon: MessageSquare, seller: false },
  { href: "/dashboard/recent", label: "Recently viewed", icon: Clock, seller: false },
  { href: "/dashboard/profile", label: "Profile & settings", icon: UserRound, seller: false },
];

export function DashboardNav({ isSeller }: { isSeller: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.seller || isSeller);
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label="Dashboard">
      {/* Mobile: horizontally scrolling tabs */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link href={item.href} aria-current={active(item.href, item.exact) ? "page" : undefined}
              className={cn("inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm",
                active(item.href, item.exact) && "border-primary bg-accent text-primary")}>
              <item.icon className="size-4" aria-hidden="true" /> {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {/* Desktop: sidebar */}
      <ul className="hidden space-y-1 lg:block">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={active(item.href, item.exact) ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                active(item.href, item.exact) && "bg-accent text-primary")}>
              <item.icon className="size-4" aria-hidden="true" /> {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
