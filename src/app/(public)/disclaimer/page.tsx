import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { VERIFIED_DISCLAIMER } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Property disclaimer",
  alternates: { canonical: "/disclaimer" },
};

// Uses only the approved wording from design.md §12. Full legal terms and
// privacy policy require approved copy (GAP-28) before launch.
export default function DisclaimerPage() {
  return (
    <div className="wrap py-12">
      <PageIntro title="Property disclaimer" />
      <p className="mt-6 max-w-3xl text-lg leading-relaxed">{VERIFIED_DISCLAIMER}</p>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        The Verified badge means the listing information was reviewed by the platform. It is not a guarantee of legal title.
      </p>
    </div>
  );
}
