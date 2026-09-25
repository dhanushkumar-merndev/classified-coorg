import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ToneBadge } from "@/components/property/badges";
import { ResultsPagination } from "@/components/search/results-pagination";
import { Card } from "@/components/ui/card";
import { requireActor } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { ENQUIRY_STATUS_LABELS } from "@/lib/labels";
import { listSentEnquiries } from "@/repositories/account";

export const metadata = { title: "My enquiries" };

export default async function MyEnquiriesPage({ searchParams }: PageProps<"/dashboard/enquiries">) {
  const actor = await requireActor();
  const page = Number((await searchParams).page ?? 1) || 1;
  const enquiries = await listSentEnquiries(actor.id, page);

  return (
    <>
      <PageHeader title="My enquiries" description="Enquiries you sent to Land in Coorg. Our team calls you back." />
      {enquiries.items.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No enquiries yet" description="Use Enquire now on any listing and our team will call you back."
          action={{ href: "/properties", label: "Find a property" }} />
      ) : (
        <>
          <ul className="space-y-3" role="list">
            {enquiries.items.map((e) => (
              <li key={e.id}>
                <Card className="gap-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {e.property
                      ? <Link href={`/property/${e.property.slug}`} className="font-semibold hover:underline">{e.property.title}</Link>
                      : <span className="font-semibold text-muted-foreground">Listing no longer available</span>}
                    <ToneBadge tone={e.status === "new" ? "info" : e.status === "read" ? "success" : "draft"}>
                      {e.status === "new" ? "Sent" : e.status === "read" ? "Our team is on it" : ENQUIRY_STATUS_LABELS[e.status]}
                    </ToneBadge>
                  </div>
                  {e.message && <p className="text-sm text-muted-foreground">“{e.message}”</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                </Card>
              </li>
            ))}
          </ul>
          <ResultsPagination page={enquiries.page} pageCount={enquiries.pageCount} hrefFor={(p) => `/dashboard/enquiries?page=${p}`} />
        </>
      )}
    </>
  );
}
