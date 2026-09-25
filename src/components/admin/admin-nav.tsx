"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, LayoutDashboard, MapPin, MessageSquare, ScrollText, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, superOnly: false },
  { href: "/admin/verification", label: "Verification queue", icon: ShieldCheck },
  { href: "/admin/properties", label: "All properties", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/enquiries", label: "Enquiries", icon: MessageSquare },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/articles", label: "Articles", icon: BookOpen },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, superOnly: true },
];

export function AdminNav({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.filter((i) => !i.superOnly || isSuper).map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white",
                  active && "bg-white/15 text-white")}>
                <i.icon className="size-4" aria-hidden="true" /> {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
