import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-9 sm:size-10 shrink-0 items-center justify-center overflow-hidden rounded-md", className)}>
      <Image
        src="/logo-on-light.png"
        alt={`${SITE_NAME} logo`}
        width={44}
        height={44}
        className="size-full object-contain"
        loading="eager"
      />
    </span>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none", className)} aria-label={`${SITE_NAME} home`}>
      <LogoMark />
      <span className={cn("text-[1.28rem] sm:text-[1.35rem] font-bold tracking-tight leading-none", inverted ? "text-white" : "text-foreground")}>
        {SITE_NAME}
      </span>
    </Link>
  );
}

