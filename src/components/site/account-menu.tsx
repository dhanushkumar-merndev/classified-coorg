"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, Heart, LayoutDashboard, LogOut, MessageSquare, ShieldCheck, UserRound,
} from "lucide-react";
import { signOutAction } from "@/app/(auth)/login/actions";
import { hasRole, useAccount } from "@/components/providers/account-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") : "U";
}

export function AccountMenu() {
  const { status, account } = useAccount();
  const pathname = usePathname();

  if (status === "loading") return <Skeleton className="size-10 rounded-md" role="status" aria-label="Loading account" />;
  if (status === "anonymous" || !account) {
    return (
      <Button asChild variant="ghost">
        <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Log in</Link>
      </Button>
    );
  }

  const isAdmin = hasRole(account, "admin", "super_admin");
  const isSeller = hasRole(account, "seller", "agent");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <Avatar className="size-8 rounded-md after:rounded-md">
            <AvatarFallback className="rounded-md bg-accent text-xs font-semibold text-primary">{initials(account.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{account.name ?? "Your account"}</div>
          <div className="truncate text-xs text-muted-foreground">{account.phone}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/dashboard"><LayoutDashboard /> Dashboard</Link></DropdownMenuItem>
        {isSeller && <DropdownMenuItem asChild><Link href="/dashboard/properties"><Building2 /> My properties</Link></DropdownMenuItem>}
        <DropdownMenuItem asChild><Link href="/dashboard/saved"><Heart /> Saved properties</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/dashboard/enquiries"><MessageSquare /> My enquiries</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/dashboard/profile"><UserRound /> Profile</Link></DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck /> Admin panel</Link></DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut /> Log out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
