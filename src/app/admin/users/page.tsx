import { Users } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { UserActions } from "@/components/admin/user-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { ToneBadge } from "@/components/property/badges";
import { ResultsPagination } from "@/components/search/results-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import { maskPhone } from "@/lib/auth/phone";
import { listAdminUsers } from "@/repositories/admin";

export const metadata = { title: "Users" };
const ROLE_NAME: Record<number, string> = { 1: "buyer", 2: "seller", 3: "agent", 4: "admin", 5: "super_admin" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const list = await listAdminUsers(page, q);
  return (
    <>
      <PageHeader title="Users" description={`${list.total} matching`} />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Name or phone" aria-label="Search users" className="h-11 rounded-lg border bg-card px-3 text-sm" />
        <button className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Search</button>
      </form>
      {list.items.length === 0 ? <EmptyState icon={Users} title="No users found" description="Try a different search." /> : (
        <>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {list.items.map((u) => {
                  const roles = u.user_roles.map((r) => ROLE_NAME[r.role_id]).filter(Boolean);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                      <TableCell>{u.phone ? maskPhone(u.phone) : "—"}</TableCell>
                      <TableCell className="text-sm">{roles.join(", ")}</TableCell>
                      <TableCell>{u.is_suspended ? <ToneBadge tone="destructive">Suspended</ToneBadge> : <ToneBadge tone="success">Active</ToneBadge>}</TableCell>
                      <TableCell>{formatDate(u.created_at)}</TableCell>
                      <TableCell><UserActions userId={u.id} suspended={u.is_suspended} roles={roles} isSelf={u.id === actor.id} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ResultsPagination page={list.page} pageCount={list.pageCount} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
