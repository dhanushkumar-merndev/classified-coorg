"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/verification", label: "Verification queue", icon: ShieldCheck },
  { href: "/admin/properties", label: "All properties", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white",
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
