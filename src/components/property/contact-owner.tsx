"use client";

import Link from "next/link";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createEnquiryAction, recordViewAction } from "@/actions/buyer";
import { useAccount } from "@/components/providers/account-provider";
import { SaveButton } from "@/components/property/save-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ENQ flow: login gate for guests (returns to this listing), one enquiry per
// idempotency key so double clicks and retries never duplicate, no private
// phone disclosure (architecture §31).

function useEnquiry(propertyId: string) {
  const { status, account } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const key = useRef<string>("");

  const openForm = () => {
    if (status !== "signed-in") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    key.current ||= crypto.randomUUID();
    setError(null);
    setOpen(true);
  };

  const submit = () =>
    startTransition(async () => {
      const result = await createEnquiryAction({ propertyId, message: message.trim() || undefined, idempotencyKey: key.current });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setSent(true);
      key.current = "";
      toast.success("Enquiry sent to the seller");
    });

  return { status, account, open, setOpen, openForm, message, setMessage, sent, error, pending, submit };
}

export function ContactOwner({ propertyId, title, priceLabel }: { propertyId: string; title: string; priceLabel: string }) {
  const e = useEnquiry(propertyId);
  const { status } = e;

  useEffect(() => {
    if (status === "signed-in") void recordViewAction(propertyId);
  }, [propertyId, status]);

  const dialog = (
    <Dialog open={e.open} onOpenChange={e.setOpen}>
      <DialogContent className="rounded-2xl">
        {e.sent ? (
          <div className="space-y-4 text-center" role="status">
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
            <DialogHeader className="items-center">
              <DialogTitle>Enquiry sent</DialogTitle>
              <DialogDescription>The seller will see your message in their dashboard. You can follow it under My enquiries.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button asChild variant="outline"><Link href="/dashboard/enquiries">My enquiries</Link></Button>
              <Button onClick={() => e.setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact the owner</DialogTitle>
              <DialogDescription>About “{title}”. Your name and number are shared with the seller through the platform.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="enquiry-message">Message (optional)</Label>
              <Textarea id="enquiry-message" maxLength={1000} rows={5} value={e.message} onChange={(ev) => e.setMessage(ev.target.value)}
                placeholder="Ask about road access, documents, a site visit…" />
              <p className="text-right text-xs text-muted-foreground">{e.message.length}/1000</p>
              {e.error && <p className="text-sm text-destructive" role="alert">{e.error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => e.setOpen(false)}>Cancel</Button>
              <Button onClick={e.submit} disabled={e.pending}>{e.pending ? "Sending…" : "Send enquiry"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Card className="gap-4 rounded-xl p-6 shadow-sm lg:sticky lg:top-20">
        <p className="text-3xl font-semibold tracking-tight">{priceLabel}</p>
        <Button size="lg" onClick={e.openForm} className="w-full"><MessageSquare /> Contact owner</Button>
        <SaveButton propertyId={propertyId} title={title} variant="full" className="w-full" />
        <p className="text-xs text-muted-foreground">
          Never pay a token advance before seeing the property and verifying documents independently.
        </p>
      </Card>
      {/* design.md §15 mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card p-3 lg:hidden">
        <SaveButton propertyId={propertyId} title={title} />
        <Button size="lg" onClick={e.openForm} className="flex-1"><MessageSquare /> Contact owner</Button>
      </div>
      {dialog}
    </>
  );
}
