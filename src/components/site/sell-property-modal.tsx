"use client";

import Image from "next/image";
import Link from "next/link";
import { Pointer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { trackPixel } from "@/lib/meta-pixel";

// Seller promo for signed-out visitors, shown 3s after a full page load (so a
// hard refresh shows it again, client navigation does not). The button sits in
// the empty field area of the artwork (~82% down).

const DELAY_MS = 3000;

// Module scope: survives layout remounts, resets on every full page load.
let shownThisLoad = false;

export function SellPropertyModal() {
  const { status } = useAccount();
  const [open, setOpen] = useState(false);

  // Wait for the account check so signed-in users never see it.
  useEffect(() => {
    if (status !== "anonymous" || shownThisLoad) return;
    const timer = setTimeout(() => {
      shownThisLoad = true;
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <Dialog open={open && status === "anonymous"} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(32rem,calc(100vw-2rem),calc(100dvh-2rem))] max-w-none gap-0 overflow-hidden p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">List your property today and sell it</DialogTitle>
        <DialogDescription className="sr-only">Post your Coorg property and reach verified buyers.</DialogDescription>
        <div className="relative aspect-square w-full">
          <Image src="/model-v2.webp" alt="" fill sizes="(max-width: 640px) 100vw, 32rem" className="object-cover" />
          <div className="absolute inset-x-0 top-[82%] flex -translate-y-1/2 justify-center">
            <Button
              asChild
              className="relative overflow-hidden bg-red-600 text-white shadow-[0_10px_25px_-5px_rgba(220,38,38,0.6),0_4px_10px_-2px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-[0_14px_30px_-5px_rgba(220,38,38,0.75),0_6px_12px_-2px_rgba(0,0,0,0.4)]"
            >
              <Link href="/dashboard/properties/new" prefetch={false} onClick={() => { trackPixel("ListPropertyClick", { source: "promo_modal" }); setOpen(false); }}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-shine bg-linear-to-r from-transparent via-white/60 to-transparent" />
                <Pointer className="animate-tap" /> List a property (Free)
              </Link>
            </Button>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white">
              <X />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
