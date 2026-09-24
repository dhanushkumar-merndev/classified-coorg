import Link from "next/link";
import { Inbox, Phone } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { EnquiryActions } from "@/components/dashboard/enquiry-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { ToneBadge } from "@/components/property/badges";
import { ResultsPagination } from "@/components/search/results-pagination";
import { Card } from "@/components/ui/card";
import { LISTING_ROLES, requirePageActor } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { ENQUIRY_STATUS_LABELS } from "@/lib/labels";
import { listReceivedEnquiries } from "@/repositories/account";
import { cn } from "@/lib/utils";

export const metadata = { title: "Received enquiries" };

const FILTERS = [
  { value: undefined, label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "closed", label: "Closed" },
] as const;

export default async function ReceivedPage({ searchParams }: PageProps<"/dashboard/received">) {
  await requirePageActor("/dashboard/received", { anyRole: LISTING_ROLES });
  const sp = await searchParams;
  const status = ["new", "read", "closed"].includes(String(sp.status)) ? (sp.status as "new" | "read" | "closed") : undefined;
  const page = Number(sp.page ?? 1) || 1;
  const enquiries = await listReceivedEnquiries(page, status);

  return (
    <>
      <PageHeader title="Received enquiries" description="Buyers who contacted you about your listings." />
      <nav aria-label="Filter enquiries" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.label} href={`/dashboard/received${f.value ? `?status=${f.value}` : ""}`}
            aria-current={status === f.value ? "page" : undefined}
            className={cn("rounded-full border bg-card px-3 py-1.5 text-sm", status === f.value && "border-primary bg-accent text-primary")}>
            {f.label}
          </Link>
        ))}
      </nav>
      {enquiries.items.length === 0 ? (
        <EmptyState icon={Inbox} title="No enquiries here" description="When buyers contact you about a listing, they appear here."
          action={{ href: "/dashboard/properties", label: "View my properties" }} />
      ) : (
        <>
          <ul className="space-y-3" role="list">
            {enquiries.items.map((e) => (
              <li key={e.id}>
                <Card className={cn("gap-3 p-5", e.status === "new" && "border-info/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.buyer_name ?? "Buyer"}</p>
                      {e.buyer_phone && (
                        <a href={`tel:${e.buyer_phone}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                          <Phone className="size-3.5" aria-hidden="true" /> {e.buyer_phone}
                        </a>
                      )}
                    </div>
                    <ToneBadge tone={e.status === "new" ? "info" : e.status === "read" ? "success" : "draft"}>{ENQUIRY_STATUS_LABELS[e.status]}</ToneBadge>
                  </div>
                  <p className="text-sm">
                    About{" "}
                    {e.property_status === "verified"
                      ? <Link href={`/property/${e.property_slug}`} className="font-medium hover:underline">{e.property_title}</Link>
                      : <span className="font-medium">{e.property_title}</span>}
                  </p>
                  {e.message && <p className="rounded-lg bg-muted p-3 text-sm">{e.message}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                    <EnquiryActions enquiryId={e.id} status={e.status} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <ResultsPagination page={enquiries.page} pageCount={enquiries.pageCount}
            hrefFor={(p) => `/dashboard/received?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
