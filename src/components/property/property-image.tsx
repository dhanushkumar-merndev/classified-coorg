"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Listing photos come from /media/<id>/<variant>, already resized and
// re-encoded to WebP at upload, so the Next image optimizer is bypassed
// (`unoptimized`); next/image still provides lazy loading, priority for the
// LCP image and layout-stable sizing. Broken or missing images fall back.

export function PropertyImage({
  src,
  alt,
  priority = false,
  className,
  sizes,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex size-full flex-col items-center justify-center gap-2 bg-muted text-subtle", className)} role="img" aria-label={`${alt} (image unavailable)`}>
        <ImageOff className="size-8" aria-hidden="true" />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      loading={priority ? undefined : "lazy"}
      sizes={sizes ?? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
