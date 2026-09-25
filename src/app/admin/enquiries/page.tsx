import { MessageSquare, Phone } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { EnquiryActions } from "@/components/dashboard/enquiry-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { ToneBadge } from "@/components/property/badges";
import { ResultsPagination } from "@/components/search/results-pagination";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { ENQUIRY_STATUS_LABELS } from "@/lib/labels";
import { listAdminEnquiries } from "@/repositories/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Enquiries" };
const TONE = { new: "info", read: "success", closed: "draft" } as const;

// Broker model: every buyer enquiry lands here. Only the platform team sees
// both sides — the buyer to call back and the owner to negotiate with.
export default async function AdminEnquiriesPage({ searchParams }: PageProps<"/admin/enquiries">) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const list = await listAdminEnquiries(page, status);
  return (
    <>
      <PageHeader title="Enquiries" description={`${list.total} matching. Call the buyer back, then work the deal with the owner.`} />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Status filter">
        {[["", "All"], ["new", "New"], ["read", "In progress"], ["closed", "Closed"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/enquiries?status=${v}` : "/admin/enquiries"} aria-current={(status ?? "") === v ? "page" : undefined}
            className={cn("rounded-md border px-3 py-1.5", (status ?? "") === v ? "border-primary bg-accent text-primary" : "bg-card")}>{l}</Link>
        ))}
      </nav>
      {list.items.length === 0 ? <EmptyState icon={MessageSquare} title="No enquiries" description="Buyer enquiries will appear here." /> : (
        <>
          <ul className="space-y-3" role="list">
            {list.items.map((e) => (
              <li key={e.id}>
                <Card className={cn("gap-4 p-5", e.status === "new" && "border-info/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold">
                      {e.property ? <Link href={`/property/${e.property.slug}`} className="hover:underline">{e.property.title}</Link> : "Listing removed"}
                    </p>
                    <ToneBadge tone={TONE[e.status] ?? "draft"}>{ENQUIRY_STATUS_LABELS[e.status] ?? e.status}</ToneBadge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Party label="Buyer" name={e.buyer?.full_name} phone={e.buyer?.phone} />
                    <Party label="Owner" name={e.seller?.full_name} phone={e.seller?.phone} />
                  </div>
                  {e.message && <p className="rounded-md bg-muted p-3 text-sm">{e.message}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                    <EnquiryActions enquiryId={e.id} status={e.status} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <ResultsPagination page={list.page} pageCount={list.pageCount} hrefFor={(p) => `/admin/enquiries?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}

function Party({ label, name, phone }: { label: string; name: string | null | undefined; phone: string | null | undefined }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{name ?? "No name yet"}</p>
      {phone ? (
        <a href={`tel:${phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Phone className="size-3.5" aria-hidden="true" /> {phone}
        </a>
      ) : <p className="text-sm text-muted-foreground">No phone</p>}
    </div>
  );
}
