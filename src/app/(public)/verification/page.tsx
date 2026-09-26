import type { Metadata } from "next";
import { BadgeCheck, FileText, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { breadcrumbLd, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { VERIFIED_DISCLAIMER } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Property Verification Process | Land in Coorg",
  description:
    "Learn how Land in Coorg verifies land documents, Bhoomi RTC records, ownership deeds, and phone numbers before publishing verified coffee estates and plots.",
  keywords: [
    "Coorg property verification",
    "Bhoomi RTC verification Coorg",
    "verified land in Coorg",
    "safe property buying Coorg",
    "Kodagu land due diligence",
  ],
  alternates: { canonical: "/verification" },
  openGraph: {
    title: "Property Verification Process | Land in Coorg",
    description:
      "Learn how Land in Coorg verifies land documents, Bhoomi RTC records, and ownership deeds before publishing.",
    url: siteUrl("/verification"),
    siteName: "Land in Coorg",
    locale: "en_IN",
    type: "website",
    images: [{ url: siteUrl("/images/hero-coorg-landscape.webp"), width: 1200, height: 630 }],
  },
};


const STEPS = [
  { icon: Smartphone, title: "Phone-verified seller", body: "Sellers sign in with a one-time code sent to their mobile." },
  { icon: FileText, title: "Documents submitted", body: "RTC, khata or title deed are uploaded and kept private." },
  { icon: UserCheck, title: "Reviewed by our team", body: "Details are checked against the documents before approval." },
  { icon: BadgeCheck, title: "Published as Verified", body: "Only approved listings go live. Edits trigger a new review." },
];

export default function VerificationPage() {
  return (
    <div className="wrap py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbLd([
          { name: "Home", url: siteUrl("/") },
          { name: "Verification", url: siteUrl("/verification") },
        ]))}
      />
      <PageIntro title="How verification works" lede="What the Verified badge means, and what it does not." />
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 rounded-md border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-md bg-accent text-primary"><s.icon className="size-5" aria-hidden="true" /></span>
              <span className="text-xs font-medium text-subtle">Step {i + 1}</span>
            </div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <Alert className="mt-8 max-w-3xl"><ShieldCheck /><AlertDescription>{VERIFIED_DISCLAIMER}</AlertDescription></Alert>
    </div>
  );
}
