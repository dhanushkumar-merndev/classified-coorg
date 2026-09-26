"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setFavoriteAction } from "@/actions/buyer";
import { useAccount } from "@/components/providers/account-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// SAVE suite: optimistic toggle with rollback; guests go to login and come
// back to the same page (AUTH-007).
export function SaveButton({ propertyId, title, variant = "icon", className }: {
  propertyId: string;
  title: string;
  variant?: "icon" | "full";
  className?: string;
}) {
  const { status, isSaved, watchSaved, setSaved } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const savedValue = isSaved(propertyId);
  const saved = savedValue ?? false;
  const busy = useRef(false);
  const [popping, setPopping] = useState(false);
  const unavailable = pending || status === "loading" || (status === "signed-in" && savedValue === undefined);

  useEffect(() => {
    if (status === "signed-in") watchSaved(propertyId);
  }, [propertyId, status, watchSaved]);

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (unavailable || busy.current) return;
    if (status !== "signed-in") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    busy.current = true;
    const next = !saved;
    setPopping(next);
    setSaved(propertyId, next);
    startTransition(async () => {
      try {
        const result = await setFavoriteAction(propertyId, next);
        if (result.error) {
          setSaved(propertyId, !next);
          setPopping(false);
          toast.error(result.error.message);
        }
      } catch {
        setSaved(propertyId, !next);
        setPopping(false);
        toast.error("Couldn’t update saved properties. Please try again.");
      } finally {
        busy.current = false;
      }
    });
  }

  const label = saved ? `Remove ${title} from saved` : `Save ${title}`;
  if (variant === "full") {
    return (
      <Button type="button" variant="outline" onClick={toggle} disabled={unavailable} aria-pressed={saved} aria-label={label} className={className}>
        <Heart aria-hidden="true" onAnimationEnd={() => setPopping(false)} className={cn("transition-colors", saved && "fill-red-600 text-red-600", popping && "animate-heart-pop")} /> {saved ? "Saved" : "Save"}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={toggle}
      disabled={unavailable}
      aria-pressed={saved}
      aria-label={label}
      className={cn("size-11 border-transparent bg-card/95 shadow-sm hover:bg-card", className)}
    >
      <Heart aria-hidden="true" onAnimationEnd={() => setPopping(false)} className={cn("transition-colors", saved && "fill-red-600 text-red-600", popping && "animate-heart-pop")} />
    </Button>
  );
}
