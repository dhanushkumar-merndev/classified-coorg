import { ScrollText } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResultsPagination } from "@/components/search/results-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { listAuditLogs } from "@/repositories/admin";

export const metadata = { title: "Audit logs" };

// Audit logs are super-admin only (GAP-05); other admins get the same 404 as any unknown page.
export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const actor = await requireActor();
  if (!actor.roles.has("super_admin")) notFound();
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const action = typeof sp.action === "string" ? sp.action.slice(0, 40) : undefined;
  const list = await listAuditLogs(page, action);
  return (
    <>
      <PageHeader title="Audit logs" description={`${list.total} entries, newest first`} />
      <form className="mb-4 flex gap-2" role="search">
        <input name="action" defaultValue={action} placeholder="Action prefix, e.g. role" aria-label="Filter by action" className="h-11 rounded-md border bg-card px-3 text-sm" />
        <button className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
      </form>
      {list.items.length === 0 ? <EmptyState icon={ScrollText} title="No entries" description="Administrative actions are recorded here." /> : (
        <>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>{r.actor?.full_name ?? "system"}</TableCell>
                    <TableCell className="font-medium">{r.action}</TableCell>
                    <TableCell className="text-muted-foreground">{r.entity_type} {r.entity_id?.slice(0, 8)}</TableCell>
                    <TableCell className="max-w-72 truncate text-xs text-muted-foreground">{JSON.stringify(r.metadata)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ResultsPagination page={list.page} pageCount={list.pageCount} hrefFor={(p) => `/admin/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
