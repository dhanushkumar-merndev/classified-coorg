import type { Metadata } from "next";
import { BadgeCheck, FileText, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VERIFIED_DISCLAIMER } from "@/lib/labels";

export const metadata: Metadata = {
  title: "How verification works",
  description: "What the Verified badge means on Land in Coorg, and what it does not mean.",
  alternates: { canonical: "/verification" },
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
