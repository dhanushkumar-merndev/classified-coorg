import { Building2 } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { ListingTable } from "@/components/admin/listing-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResultsPagination } from "@/components/search/results-pagination";
import { PROPERTY_STATUSES, type PropertyStatus } from "@/lib/domain/property-lifecycle";
import { STATUS_LABELS } from "@/lib/labels";
import { listAdminProperties } from "@/repositories/admin";

export const metadata = { title: "All properties" };

export default async function AdminPropertiesPage({ searchParams }: PageProps<"/admin/properties">) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const status = PROPERTY_STATUSES.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const list = await listAdminProperties({ page, status, q });
  const qs = (p: number) => `/admin/properties?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="All properties" description={`${list.total} matching`} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search title" aria-label="Search title" className="h-11 rounded-lg border bg-card px-3 text-sm" />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="h-11 rounded-lg border bg-card px-3 text-sm">
          <option value="">All statuses</option>
          {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s as PropertyStatus]}</option>)}
        </select>
        <button className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
        <Link href="/admin/properties" className="flex h-11 items-center px-2 text-sm text-muted-foreground underline">Reset</Link>
      </form>
      {list.items.length === 0
        ? <EmptyState icon={Building2} title="No properties match" description="Try clearing the filters." />
        : <><ListingTable rows={list.items} /><ResultsPagination page={list.page} pageCount={list.pageCount} hrefFor={qs} /></>}
    </>
  );
}
