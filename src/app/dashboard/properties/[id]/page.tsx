import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ListingManageActions } from "@/components/dashboard/listing-manage-actions";
import { StatusBadge, ToneBadge } from "@/components/property/badges";
import { PropertyImage } from "@/components/property/property-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isEditable } from "@/lib/domain/property-lifecycle";
import { formatArea, formatDate, formatDateTime, formatPriceFull } from "@/lib/format";
import { DOCUMENT_TYPE_LABELS, PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS } from "@/lib/labels";
import { requireActor } from "@/lib/auth/dal";
import { mediaUrl } from "@/lib/site";
import { getOwnListing, getOwnerFeedback } from "@/repositories/account";

export const metadata = { title: "Manage listing" };

export default async function ManageListingPage({ params }: PageProps<"/dashboard/properties/[id]">) {
  await requireActor();
  const { id } = await params;
  const listing = await getOwnListing(id);
  if (!listing) notFound();
  const { reviews, history } = await getOwnerFeedback(id);
  const editable = isEditable(listing.status);
  const latestReview = reviews.find((r) => r.owner_message);

  return (
    <>
      <PageHeader
        title={listing.title || "Untitled draft"}
        description={`Last updated ${formatDate(listing.updated_at)}`}
        actions={editable ? <Button asChild variant="outline"><Link href={`/dashboard/properties/${id}/edit`}><Pencil /> Edit listing</Link></Button> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Details</CardTitle>
              <StatusBadge status={listing.status} />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Detail label="Property type" value={listing.property_type ? PROPERTY_TYPE_LABELS[listing.property_type] : "—"} />
              <Detail label="Seller type" value={listing.seller_type ? SELLER_TYPE_LABELS[listing.seller_type] : "—"} />
              <Detail label="Price" value={formatPriceFull(listing.price)} />
              <Detail label="Area" value={formatArea(listing.area_value, listing.area_unit)} />
              <Detail label="Location" value={listing.location?.name ?? "—"} />
              <Detail label="Address" value={listing.address_text ?? "—"} />
            </CardContent>
          </Card>

          {latestReview?.owner_message && (
            <Card className="border-warning/40 bg-warning/5">
              <CardHeader><CardTitle className="text-base">Feedback from review</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{latestReview.owner_message}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Photos ({listing.media.length})</CardTitle></CardHeader>
            <CardContent>
              {listing.media.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {listing.media.map((m) => (
                    <div key={m.id} className="relative aspect-square overflow-hidden rounded-md border">
                      <PropertyImage src={mediaUrl(m.id, "thumb")} alt={m.alt_text ?? "Listing photo"} sizes="150px" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Documents ({listing.documents.length})</CardTitle></CardHeader>
            <CardContent>
              {listing.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                <ul className="space-y-2">
                  {listing.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <span>{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</span>
                      <span className="text-muted-foreground">{formatDate(d.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ListingManageActions id={id} status={listing.status} version={listing.version} />

          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <ToneBadge tone="info" className="text-xs">{h.action}</ToneBadge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                      </div>
                      {h.reason && <p className="mt-1 text-muted-foreground">{h.reason}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
