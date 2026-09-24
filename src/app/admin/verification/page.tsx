import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ListingTable } from "@/components/admin/listing-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResultsPagination } from "@/components/search/results-pagination";
import { listAdminProperties } from "@/repositories/admin";

export const metadata = { title: "Verification queue" };

export default async function QueuePage({ searchParams }: PageProps<"/admin/verification">) {
  const page = Number((await searchParams).page ?? 1) || 1;
  const list = await listAdminProperties({ page, queue: true });
  return (
    <>
      <PageHeader title="Verification queue" description={`${list.total} awaiting review, oldest first`} />
      {list.items.length === 0
        ? <EmptyState icon={ShieldCheck} title="Queue is clear" description="New submissions will appear here." />
        : <><ListingTable rows={list.items} /><ResultsPagination page={list.page} pageCount={list.pageCount} hrefFor={(p) => `/admin/verification?page=${p}`} /></>}
    </>
  );
}
