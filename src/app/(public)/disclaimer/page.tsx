import type { Metadata } from "next";
import { VERIFIED_DISCLAIMER } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Property disclaimer",
  alternates: { canonical: "/disclaimer" },
};

// Uses only the approved wording from design.md §12. Full legal terms and
// privacy policy require approved copy (GAP-28) before launch.
export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Property disclaimer</h1>
      <p className="mt-6 text-lg leading-relaxed">{VERIFIED_DISCLAIMER}</p>
      <p className="mt-4 text-muted-foreground">
        The Verified badge means the listing information was reviewed by the platform. It is not a guarantee of legal title.
      </p>
    </div>
  );
}
