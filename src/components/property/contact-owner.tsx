"use client";

import Link from "next/link";
import { CheckCircle2, MessageCircle, MessageSquare, Phone } from "lucide-react";
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
import { contactLinks } from "@/lib/site";

// ENQ flow (broker model): buyers enquire with Land in Coorg, never with the
// seller — the enquiry reaches the platform team only. Login gate for guests
// (returns to this listing); one enquiry per idempotency key so double clicks
// and retries never duplicate.

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
    if (status === "loading") return;
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
      toast.success("Enquiry sent. Our team will call you soon.");
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
      <DialogContent className="rounded-md">
        {e.sent ? (
          <div className="space-y-4 text-center" role="status">
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
            <DialogHeader className="items-center">
              <DialogTitle>We have your enquiry</DialogTitle>
              <DialogDescription>Our team will call you shortly to answer questions and arrange a site visit. You can follow it under My enquiries.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button asChild variant="outline"><Link href="/dashboard/enquiries">My enquiries</Link></Button>
              <Button onClick={() => e.setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enquire about this property</DialogTitle>
              <DialogDescription>About “{title}”. Our team will call you back. Your number stays with Land in Coorg and is never shared with the seller.</DialogDescription>
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

  const links = contactLinks(`Hi, I'm interested in "${title}"`);

  return (
    <>
      <Card className="gap-4 rounded-md p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Asking price</p>
          <p className="text-3xl font-semibold tracking-tight">{priceLabel}</p>
        </div>
        <p className="text-sm text-muted-foreground">Our team answers questions, arranges site visits and handles the paperwork.</p>
        <div className="grid gap-2">
          <Button size="lg" onClick={e.openForm} disabled={status === "loading"} className="w-full"><MessageSquare /> Enquire now</Button>
          {links && (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline"><a href={links.tel}><Phone /> Call us</a></Button>
              <Button asChild variant="outline"><a href={links.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></Button>
            </div>
          )}
          <SaveButton propertyId={propertyId} title={title} variant="full" className="w-full" />
        </div>
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Never pay a token advance before seeing the property and verifying documents independently.
        </p>
      </Card>
      {/* design.md §15 mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card p-3 lg:hidden">
        <SaveButton propertyId={propertyId} title={title} className="size-12 border-border" />
        {links && (
          <Button asChild variant="outline" size="icon-lg" aria-label="Call Land in Coorg"><a href={links.tel}><Phone /></a></Button>
        )}
        <Button size="lg" onClick={e.openForm} disabled={status === "loading"} className="flex-1"><MessageSquare /> Enquire now</Button>
      </div>
      {dialog}
    </>
  );
}
