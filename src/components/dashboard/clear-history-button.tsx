"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { clearRecentlyViewedAction } from "@/actions/buyer";
import { Button } from "@/components/ui/button";

export function ClearHistoryButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await clearRecentlyViewedAction();
      if (r.error) toast.error(r.error.message);
      else { toast.success("History cleared"); router.refresh(); }
    })}>
      <Trash2 /> Clear history
    </Button>
  );
}
