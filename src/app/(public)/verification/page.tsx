import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VERIFIED_DISCLAIMER } from "@/lib/labels";

export const metadata: Metadata = {
  title: "How verification works",
  description: "What the Verified badge means on Land in Coorg, and what it does not mean.",
  alternates: { canonical: "/verification" },
};

const STEPS = [
  { title: "Phone-verified seller", body: "Every seller signs in with a one-time code sent to their mobile number." },
  { title: "Photos and documents submitted", body: "Sellers upload photos and supporting land documents such as the RTC, khata or title deed. Documents stay private." },
  { title: "Reviewed by our team", body: "A reviewer checks the listing details against the submitted documents and can approve it, reject it, or ask the seller for changes." },
  { title: "Published as Verified", body: "Only approved listings appear publicly. Any change to reviewed content requires a new review." },
];

export default function VerificationPage() {
  return (
    <div className="wrap py-12 md:py-16">
      <PageIntro eyebrow="Trust" title="How verification works" lede="What the Verified badge on a listing means, and what it does not." />
      <ol className="mt-10 grid border-l border-t md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="space-y-3 border-b border-r p-6">
            <span className="text-sm font-medium tabular-nums text-clay">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="text-lg font-medium">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <Alert className="mt-10 max-w-3xl"><ShieldCheck /><AlertDescription>{VERIFIED_DISCLAIMER}</AlertDescription></Alert>
    </div>
  );
}
