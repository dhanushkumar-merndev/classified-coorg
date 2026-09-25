import { LocationForm } from "@/components/admin/location-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { ToneBadge } from "@/components/property/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminLocations } from "@/repositories/admin";

export const metadata = { title: "Locations" };

export default async function AdminLocationsPage() {
  const all = await listAdminLocations();
  const name = new Map(all.map((l) => [l.id, l.name]));
  return (
    <>
      <PageHeader title="Locations" description={`${all.length} locations`} actions={<LocationForm all={all} />} />
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Parent</TableHead><TableHead>Slug</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {all.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell>{l.type}</TableCell>
                <TableCell>{l.parent_id ? name.get(l.parent_id) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.slug}</TableCell>
                <TableCell>{l.is_active ? <ToneBadge tone="success">Active</ToneBadge> : <ToneBadge tone="draft">Hidden</ToneBadge>}</TableCell>
                <TableCell className="text-right"><LocationForm location={l} all={all} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
