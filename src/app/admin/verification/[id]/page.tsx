import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ReviewActions } from "@/components/admin/review-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/property/badges";
import { VideoTour } from "@/components/property/video-tour";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArea, formatDateTime, formatPriceFull } from "@/lib/format";
import {
  DOCUMENT_TYPE_LABELS, FEATURE_LABELS, PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS, VIDEO_ERROR_FALLBACK, VIDEO_ERROR_LABELS,
} from "@/lib/labels";
import { videoUrl } from "@/lib/site";
import { getReviewDetail } from "@/repositories/admin";

export const metadata = { title: "Review listing" };

export default async function ReviewPage({ params }: PageProps<"/admin/verification/[id]">) {
  const detail = await getReviewDetail((await params).id);
  if (!detail) notFound();
  const { property: p, history, notes } = detail;
  const owner = p.owner as unknown as { full_name: string | null; phone: string | null; email: string | null; user_type: string } | null;
  const location = p.location as unknown as { name: string } | null;
  const media = p.media as unknown as Array<{ id: string; is_cover: boolean; alt_text: string | null }>;
  const docs = p.documents as unknown as Array<{ id: string; document_type: string; original_filename: string | null }>;
  const features = p.features as unknown as Array<{ feature_key: string; feature_value: string | null }>;
  const video = (p.video as unknown as Array<{
    id: string; state: string; error_code: string | null; duration_seconds: number | null; width: number | null; height: number | null;
  }>)[0] ?? null;

  return (
    <>
      <PageHeader title={p.title || "Untitled draft"} description="Review the submitted details, photos, video and documents."
        actions={<StatusBadge status={p.status} />} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <Row l="Type" v={p.property_type ? PROPERTY_TYPE_LABELS[p.property_type] : "—"} />
                <Row l="Seller type" v={p.seller_type ? SELLER_TYPE_LABELS[p.seller_type] : "—"} />
                <Row l="Price" v={`${formatPriceFull(p.price)}${p.negotiable ? " (negotiable)" : ""}`} />
                <Row l="Area" v={formatArea(p.area_value, p.area_unit)} />
                <Row l="Location" v={location?.name ?? "—"} />
                <Row l="Address" v={p.address_text ?? "—"} />
                <Row l="Road / Water / Power" v={[p.road_access, p.water_available, p.electricity_available].map((b) => b === null ? "?" : b ? "Yes" : "No").join(" / ")} />
              </dl>
              <p className="whitespace-pre-wrap text-sm">{p.description}</p>
              {features.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">
                {features.map((f) => <li key={f.feature_key} className="rounded-md border px-2.5 py-1">{FEATURE_LABELS[f.feature_key] ?? f.feature_key}{f.feature_value && f.feature_value !== "true" ? `: ${f.feature_value}` : ""}</li>)}
              </ul>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Photos ({media.length})</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((m) => (
                <a key={m.id} href={`/api/media/preview/${m.id}/full`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/preview/${m.id}/thumb`} alt={m.alt_text ?? "Listing photo"} className="aspect-[4/3] w-full rounded-md border object-cover" />
                </a>
              ))}
              {media.length === 0 && <p className="text-sm text-muted-foreground">No photos.</p>}
            </CardContent>
          </Card>
          {video && (
            <Card>
              <CardHeader><CardTitle>Video tour</CardTitle></CardHeader>
              <CardContent>
                {video.state === "ready" ? (
                  <VideoTour
                    title={p.title ?? "this listing"}
                    src={videoUrl(video.id, "master.m3u8", true)}
                    posterUrl={videoUrl(video.id, "poster.jpg", true)}
                    durationSeconds={video.duration_seconds === null ? null : Number(video.duration_seconds)}
                    shortSide={video.width && video.height ? Math.min(video.width, video.height) : null}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {video.state === "processing"
                      ? "Still processing."
                      : `Failed: ${(video.error_code && VIDEO_ERROR_LABELS[video.error_code]) ?? VIDEO_ERROR_FALLBACK}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Documents ({docs.length})</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <span>{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</span>
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">Open <ExternalLink className="size-3.5" /></a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Owner</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{owner?.full_name ?? "—"}</p>
              <p className="text-muted-foreground">{owner?.phone}</p>
              <p className="text-muted-foreground">{owner?.email}</p>
              <Link href={`/admin/users?q=${encodeURIComponent(owner?.phone ?? "")}`} className="text-primary underline">Find in users</Link>
            </CardContent>
          </Card>
          <ReviewActions id={p.id} status={p.status} version={p.version} revisionId={p.current_revision_id} featured={p.featured} />
          <Card>
            <CardHeader><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
            <CardContent>
              {notes.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
                <ul className="space-y-3 text-sm">{notes.map((n) => <li key={n.id}><p>{n.note}</p><p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p></li>)}</ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {history.map((h) => <li key={h.id}><span className="font-medium">{h.action}</span> <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>{h.reason && <p className="text-muted-foreground">{h.reason}</p>}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div><dt className="text-xs text-muted-foreground">{l}</dt><dd className="font-medium">{v}</dd></div>;
}
