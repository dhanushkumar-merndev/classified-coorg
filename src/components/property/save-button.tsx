"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
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
  const saved = isSaved(propertyId) ?? false;

  useEffect(() => {
    if (status === "signed-in") watchSaved(propertyId);
  }, [propertyId, status, watchSaved]);

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (status === "loading") return;
    if (status !== "signed-in") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !saved;
    setSaved(propertyId, next);
    startTransition(async () => {
      const result = await setFavoriteAction(propertyId, next);
      if (result.error) {
        setSaved(propertyId, !next);
        toast.error(result.error.message);
      } else {
        toast.success(next ? "Saved to your list" : "Removed from saved");
      }
    });
  }

  const label = saved ? `Remove ${title} from saved` : `Save ${title}`;
  if (variant === "full") {
    return (
      <Button type="button" variant="outline" onClick={toggle} disabled={pending || status === "loading"} aria-pressed={saved} aria-label={label} className={className}>
        <Heart className={cn(saved && "fill-destructive text-destructive")} /> {saved ? "Saved" : "Save"}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={toggle}
      disabled={pending || status === "loading"}
      aria-pressed={saved}
      aria-label={label}
      className={cn("size-9 border-transparent bg-card/95 shadow-sm hover:bg-card", className)}
    >
      <Heart className={cn(saved && "fill-destructive text-destructive")} />
    </Button>
  );
}
