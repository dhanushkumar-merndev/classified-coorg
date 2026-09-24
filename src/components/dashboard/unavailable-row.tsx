"use client";

import { EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setFavoriteAction } from "@/actions/buyer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// A saved listing that is no longer public (sold, under review again,
// removed). Its details are not shown (GAP-02); the user can remove it.
export function UnavailableRow({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card className="h-full items-center justify-center gap-3 p-6 text-center">
      <EyeOff className="size-6 text-subtle" aria-hidden="true" />
      <p className="font-medium">This listing is no longer available</p>
      <p className="text-sm text-muted-foreground">It may have been sold or taken down by the seller.</p>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
        const r = await setFavoriteAction(propertyId, false);
        if (r.error) toast.error(r.error.message); else router.refresh();
      })}>Remove from saved</Button>
    </Card>
  );
}
