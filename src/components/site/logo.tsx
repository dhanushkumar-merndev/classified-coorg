import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M6 23 L13 12 L17 18 L20 14 L26 23 Z" fill="#fff" />
      <circle cx="22.5" cy="9.5" r="2.5" fill="#fff" opacity="0.85" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 rounded-lg", className)} aria-label={`${SITE_NAME} home`}>
      <LogoMark />
      <span className={cn("text-lg font-semibold tracking-tight", inverted ? "text-white" : "text-foreground")}>
        {SITE_NAME}
      </span>
    </Link>
  );
}
