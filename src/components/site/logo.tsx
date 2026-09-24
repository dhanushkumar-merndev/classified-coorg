import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <path d="M5 23.5c3.2-1.6 5.4-6.8 8.6-6.8 2.4 0 3 2.6 5.2 2.6 2.4 0 3.4-4.6 8.2-4.6" fill="none" stroke="#f7f5ef" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 18.5c3.2-1.6 5.4-6.8 8.6-6.8 2.4 0 3 2.6 5.2 2.6 2.4 0 3.4-4.6 8.2-4.6" fill="none" stroke="#f7f5ef" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 rounded-md", className)} aria-label={`${SITE_NAME} home`}>
      <LogoMark />
      <span className={cn("text-[1.15rem] font-bold tracking-tight leading-none", inverted ? "text-white" : "text-foreground")}>
        {SITE_NAME}
      </span>
    </Link>
  );
}
