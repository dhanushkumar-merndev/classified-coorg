import type { Metadata } from "next";
import { FileCheck2, ShieldCheck, Upload, UserCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VERIFIED_DISCLAIMER } from "@/lib/labels";

export const metadata: Metadata = {
  title: "How verification works",
  description: "What the Verified badge means on Land in Coorg, and what it does not mean.",
  alternates: { canonical: "/verification" },
};

const STEPS = [
  { icon: UserCheck, title: "Phone-verified seller", body: "Every seller signs in with a one-time code sent to their mobile number." },
  { icon: Upload, title: "Photos and documents submitted", body: "Sellers upload photos and supporting land documents such as the RTC, khata or title deed. Documents stay private." },
  { icon: FileCheck2, title: "Reviewed by our team", body: "A reviewer checks the listing details against the submitted documents and can approve it, reject it, or ask the seller for changes." },
  { icon: ShieldCheck, title: "Published as Verified", body: "Only approved listings appear publicly. Any change to reviewed content requires a new review." },
];

export default function VerificationPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">How verification works</h1>
      <ol className="mt-8 space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><s.icon className="size-5" aria-hidden="true" /></div>
            <div>
              <h2 className="font-semibold">{i + 1}. {s.title}</h2>
              <p className="text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Alert className="mt-10"><ShieldCheck /><AlertDescription>{VERIFIED_DISCLAIMER}</AlertDescription></Alert>
    </div>
  );
}
