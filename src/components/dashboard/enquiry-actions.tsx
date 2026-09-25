"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateEnquiryStatusAction } from "@/actions/account";
import { Button } from "@/components/ui/button";

export function EnquiryActions({ enquiryId, status }: { enquiryId: string; status: "new" | "read" | "closed" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (next: "read" | "closed") => start(async () => {
    const r = await updateEnquiryStatusAction({ enquiryId, status: next });
    if (r.error) toast.error(r.error.message);
    else router.refresh();
  });
  if (status === "closed") return null;
  return (
    <div className="flex gap-2">
      {status === "new" && <Button size="sm" variant="outline" disabled={pending} onClick={() => set("read")}>Mark as called</Button>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("closed")}>Close</Button>
    </div>
  );
}
