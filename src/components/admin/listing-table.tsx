import Link from "next/link";
import { StatusBadge } from "@/components/property/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPriceShort } from "@/lib/format";
import type { AdminListingRow } from "@/repositories/admin";

export function ListingTable({ rows }: { rows: AdminListingRow[] }) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Listing</TableHead><TableHead>Owner</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell><Link href={`/admin/verification/${r.id}`} className="font-medium hover:underline">{r.title || "Untitled draft"}</Link>{r.featured && <span className="ml-2 text-xs text-primary">Featured</span>}</TableCell>
              <TableCell>{r.owner?.full_name ?? "—"}</TableCell>
              <TableCell>{formatPriceShort(r.price)}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell>{formatDate(r.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
