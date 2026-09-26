"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  arrangeMediaAction, ownerTransitionAction, removeDocumentAction, removeMediaAction, removeVideoAction, saveDraftAction,
  saveFeaturesAction,
} from "@/actions/listing";
import { PropertyImage } from "@/components/property/property-image";
import { VideoTour } from "@/components/property/video-tour";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ListingDetailsEditor } from "@/components/dashboard/listing-details-editor";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AREA_UNIT_LABELS, formatArea, formatPriceFull } from "@/lib/format";
import {
  DOCUMENT_TYPE_LABELS, PROPERTY_TYPE_LABELS, SELLER_TYPE_LABELS, SUBMISSION_GAP_LABELS,
  VIDEO_ERROR_FALLBACK, VIDEO_ERROR_LABELS,
} from "@/lib/labels";
import { mediaUrl, videoUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { OwnListingDetail } from "@/repositories/account";
import type { LocationRow } from "@/repositories/public-listings";
import { AREA_UNITS, PROPERTY_TYPES, propertyDraftPatchSchema, SELLER_TYPES, type PropertyDraftPatch } from "@/schemas/property.schema";
import { DOCUMENT_TYPES, IMAGE_LIMITS, VIDEO_LIMITS } from "@/lib/config/uploads";
import { STORED_DETAIL_OPTIONS, listingDetailGaps } from "@/lib/listing/details";
import { textHasContactDetails } from "@/lib/listing/contact-details";
import { PHOTO_RATIO_HINT, PHOTO_RULES, photoOrientation, photoSizeProblem, photoSummary } from "@/lib/media/photo-rules";

const DEBOUNCE_MS = 750;
const VIDEO_POLL_MS = 4000;
const MAX_WAIT_MS = 3000;

type FormValues = PropertyDraftPatch;

function toFormValues(listing: OwnListingDetail): FormValues {
  return {
    title: listing.title, description: listing.description, property_type: listing.property_type as FormValues["property_type"],
    listing_type: listing.listing_type as FormValues["listing_type"], seller_type: listing.seller_type as FormValues["seller_type"],
    price: listing.price, negotiable: listing.negotiable, area_value: listing.area_value,
    area_unit: listing.area_unit as FormValues["area_unit"], location_id: listing.location_id,
    latitude: null, longitude: null, address_text: listing.address_text,
    road_access: listing.road_access, water_available: listing.water_available, electricity_available: listing.electricity_available,
  };
}

function computeGaps(v: FormValues, media: Array<{ width: number; height: number }>, hasCover: boolean, docCount: number,
  videoProcessing: boolean): string[] {
  const gaps: string[] = [];
  if (!v.title || v.title.trim().length < 10) gaps.push("title");
  if (!v.description || v.description.trim().length < 50) gaps.push("description");
  if (textHasContactDetails(`${v.title ?? ""} ${v.description ?? ""}`)) gaps.push("contact_details");
  if (!v.property_type) gaps.push("property_type");
  if (!v.seller_type) gaps.push("seller_type");
  if (!v.price) gaps.push("price");
  if (!v.area_value || !v.area_unit) gaps.push("area");
  if (!v.location_id) gaps.push("location");
  gaps.push(...photoSummary(media).gaps);
  if (!hasCover) gaps.push("cover_photo");
  if (docCount === 0) gaps.push("documents");
  if (videoProcessing) gaps.push("video_processing");
  return gaps;
}

/** Type, size and real (EXIF-rotated) dimensions, before any upload. */
async function checkPhotoLocally(file: File): Promise<string | null> {
  if (!(IMAGE_LIMITS.acceptedMimeTypes as readonly string[]).includes(file.type)) return "Use a JPEG, PNG or WebP photo.";
  if (file.size > IMAGE_LIMITS.maxBytes) return "Larger than 10 MB. Export a smaller copy and try again.";
  let width = 0;
  let height = 0;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch {
    return "This file could not be read as an image.";
  }
  return photoSizeProblem(width, height);
}

/** Type, size, length and resolution, before any upload. The server checks
 *  again; a file the browser cannot decode (e.g. HEVC in some browsers) is
 *  left to the server. */
async function checkVideoLocally(file: File): Promise<string | null> {
  if (!(VIDEO_LIMITS.acceptedMimeTypes as readonly string[]).includes(file.type)) return "Use an MP4, MOV or WebM video.";
  if (file.size > VIDEO_LIMITS.maxBytes) return "Larger than 500 MB. Export a shorter or 1080p copy and try again.";
  const url = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ duration: number; width: number; height: number } | null>((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;
      const timer = setTimeout(() => resolve(null), 8000);
      probe.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve({ duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight });
      };
      probe.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      probe.src = url;
    });
    if (!meta) return null;
    if (Number.isFinite(meta.duration) && meta.duration > VIDEO_LIMITS.maxDurationSeconds + VIDEO_LIMITS.durationToleranceSeconds) {
      return "Longer than 2 minutes. Trim it and try again.";
    }
    if (meta.width && meta.height && Math.min(meta.width, meta.height) > VIDEO_LIMITS.maxShortSide) {
      return "Resolution is above 4K. Export at 4K or 1080p and try again.";
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function uploadWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.send(file);
  });
}

interface UploadRow { id: string; name: string; progress: number; status: "uploading" | "finalizing" | "error"; error?: string }

export function ListingEditor({ listing, locations }: { listing: OwnListingDetail; locations: LocationRow[] }) {
  const router = useRouter();
  const versionRef = useRef(listing.version);
  const savedRef = useRef<FormValues>(toFormValues(listing));
  const pendingDraftSaveRef = useRef<ReturnType<typeof saveDraftAction> | null>(null);
  const hasUnsavedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [conflict, setConflict] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES[0]);
  const [features, setFeatures] = useState<Record<string, string>>(() =>
    Object.fromEntries(STORED_DETAIL_OPTIONS.map((f) => [f.key, listing.features.find((x) => x.feature_key === f.key)?.feature_value ?? ""])));
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const featuresDirtyRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(propertyDraftPatchSchema),
    defaultValues: savedRef.current,
    mode: "onChange",
  });

  function computeDiff(): Partial<FormValues> {
    const current = form.getValues();
    const diff: Record<string, unknown> = {};
    for (const key of Object.keys(savedRef.current) as Array<keyof FormValues>) {
      if (!Object.is(current[key], savedRef.current[key])) diff[key] = current[key];
    }
    return diff;
  }

  async function flush(): Promise<boolean> {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    debounceRef.current = undefined;
    maxWaitRef.current = undefined;
    if (pendingDraftSaveRef.current) {
      const previous = await pendingDraftSaveRef.current;
      if (previous.error) return false;
      return flush();
    }

    const diff = computeDiff();
    const errors = form.formState.errors;
    const clean = Object.fromEntries(Object.entries(diff).filter(([k]) => !(k in errors)));
    if (Object.keys(clean).length === 0) {
      if (Object.keys(diff).length === 0) hasUnsavedRef.current = false;
      return Object.keys(errors).length === 0;
    }

    setSaveState("saving");
    const pending = saveDraftAction({ propertyId: listing.id, expectedVersion: versionRef.current, patch: clean });
    pendingDraftSaveRef.current = pending;
    const r = await pending;
    pendingDraftSaveRef.current = null;
    if (r.error) {
      setSaveState("error");
      if (r.error.code === "VERSION_CONFLICT") setConflict(true);
      toast.error(r.error.message);
    } else {
      savedRef.current = { ...savedRef.current, ...(clean as Partial<FormValues>) };
      versionRef.current = r.data.version;
      setSaveState("saved");
      if (Object.keys(computeDiff()).length === 0) hasUnsavedRef.current = false;
    }
    if (r.error) return false;
    return Object.keys(computeDiff()).length > 0 ? flush() : true;
  }

  function schedule() {
    hasUnsavedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, DEBOUNCE_MS);
    if (!maxWaitRef.current) maxWaitRef.current = setTimeout(flush, MAX_WAIT_MS);
  }

  useEffect(() => {
    const sub = form.watch((_values, info) => { if (info.name) schedule(); });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasUnsavedRef.current || featuresDirtyRef.current) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const values = form.watch();
  const mediaSorted = [...listing.media].sort((a, b) => a.sort_order - b.sort_order);
  const hasCover = mediaSorted.some((m) => m.is_cover);
  const video = listing.video?.[0] ?? null;
  const gaps = [...computeGaps(values, mediaSorted, hasCover, listing.documents.length, video?.state === "processing"),
    ...listingDetailGaps(values, features)];

  // While the video transcodes, poll its status; the page refreshes when it
  // is ready or failed. Polling also restarts any stalled transcode job.
  const processingVideoId = video?.state === "processing" ? video.id : null;
  useEffect(() => {
    if (!processingVideoId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${processingVideoId}`, { cache: "no-store" });
        const body = await res.json();
        if (body.data && body.data.state !== "processing") router.refresh();
        if (body.error?.code === "MEDIA_NOT_FOUND") router.refresh();
      } catch {
        // Try again on the next tick.
      }
    }, VIDEO_POLL_MS);
    return () => clearInterval(timer);
  }, [processingVideoId, router]);

  const photos = photoSummary(mediaSorted);

  async function uploadPhoto(file: File) {
    const id = crypto.randomUUID();
    // Checked in the browser first so a wrong file never uploads.
    const problem = await checkPhotoLocally(file);
    if (problem) {
      setUploads((u) => [...u, { id, name: file.name, progress: 0, status: "error", error: problem }]);
      return;
    }
    setUploads((u) => [...u, { id, name: file.name, progress: 0, status: "uploading" }]);
    try {
      const initRes = await fetch("/api/uploads", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "property_image", propertyId: listing.id, fileName: file.name, contentType: file.type, size: file.size }),
      });
      const init = await initRes.json();
      if (init.error) throw new Error(init.error.message);
      await uploadWithProgress(init.data.upload.url, init.data.upload.headers, file,
        (pct) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: pct } : x))));
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "finalizing" } : x)));
      const finRes = await fetch(`/api/uploads/${init.data.sessionId}/finalize`, { method: "POST" });
      const fin = await finRes.json();
      if (fin.error) throw new Error(fin.error.message);
      setUploads((u) => u.filter((x) => x.id !== id));
      router.refresh();
    } catch (error) {
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "error", error: (error as Error).message } : x)));
    }
  }

  async function uploadDocument(file: File) {
    const id = crypto.randomUUID();
    setUploads((u) => [...u, { id, name: file.name, progress: 0, status: "uploading" }]);
    try {
      const initRes = await fetch("/api/uploads", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "property_document", propertyId: listing.id, documentType: docType, fileName: file.name, contentType: file.type, size: file.size }),
      });
      const init = await initRes.json();
      if (init.error) throw new Error(init.error.message);
      await uploadWithProgress(init.data.upload.url, init.data.upload.headers, file,
        (pct) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: pct } : x))));
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "finalizing" } : x)));
      const finRes = await fetch(`/api/uploads/${init.data.sessionId}/finalize`, { method: "POST" });
      const fin = await finRes.json();
      if (fin.error) throw new Error(fin.error.message);
      setUploads((u) => u.filter((x) => x.id !== id));
      router.refresh();
    } catch (error) {
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "error", error: (error as Error).message } : x)));
    }
  }

  async function uploadVideo(file: File) {
    const id = crypto.randomUUID();
    const problem = await checkVideoLocally(file);
    if (problem) {
      setUploads((u) => [...u, { id, name: file.name, progress: 0, status: "error", error: problem }]);
      return;
    }
    setUploads((u) => [...u, { id, name: file.name, progress: 0, status: "uploading" }]);
    try {
      const initRes = await fetch("/api/uploads", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "property_video", propertyId: listing.id, fileName: file.name, contentType: file.type, size: file.size }),
      });
      const init = await initRes.json();
      if (init.error) throw new Error(init.error.message);
      await uploadWithProgress(init.data.upload.url, init.data.upload.headers, file,
        (pct) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: pct } : x))));
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "finalizing" } : x)));
      const finRes = await fetch(`/api/uploads/${init.data.sessionId}/finalize`, { method: "POST" });
      const fin = await finRes.json();
      if (fin.error) throw new Error(fin.error.message);
      setUploads((u) => u.filter((x) => x.id !== id));
      router.refresh();
    } catch (error) {
      setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "error", error: (error as Error).message } : x)));
    }
  }

  async function removeVideo(videoId: string) {
    const r = await removeVideoAction({ videoId });
    if (r.error) toast.error(r.error.message); else router.refresh();
  }

  async function reorder(newOrder: string[], coverId: string) {
    const r = await arrangeMediaAction({ propertyId: listing.id, orderedIds: newOrder, coverId });
    if (r.error) toast.error(r.error.message); else router.refresh();
  }

  async function saveFeatures(notify = true) {
    setFeaturesSaving(true);
    const r = await saveFeaturesAction({ propertyId: listing.id, features });
    setFeaturesSaving(false);
    if (r.error) {
      toast.error(r.error.message);
      return false;
    }
    featuresDirtyRef.current = false;
    if (notify) toast.success("Amenities and features saved");
    return true;
  }

  async function submit() {
    if (gaps.length > 0) {
      toast.error("Some required details are missing", { description: gaps.map((g) => SUBMISSION_GAP_LABELS[g]).join(", ") });
      return;
    }
    setSubmitting(true);
    if (!(await flush())) { setSubmitting(false); return; }
    if (!(await saveFeatures(false))) { setSubmitting(false); return; }
    const r = await ownerTransitionAction({ propertyId: listing.id, action: "submit", expectedVersion: versionRef.current, requestId: crypto.randomUUID() });
    setSubmitting(false);
    if (r.error) {
      if (r.error.code === "VERSION_CONFLICT") setConflict(true);
      else if (r.error.code === "LISTING_INCOMPLETE" && r.error.detail) {
        toast.error("Some required details are missing", { description: r.error.detail.split(",").map((g) => SUBMISSION_GAP_LABELS[g] ?? g).join(", ") });
        return;
      }
      toast.error(r.error.message);
    } else {
      toast.success("Submitted for review");
      router.push(`/dashboard/properties/${listing.id}`);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      {conflict && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>This listing changed elsewhere</AlertTitle>
          <AlertDescription>
            Reload to see the latest version before making more changes.
            <Button size="sm" variant="outline" className="mt-2" onClick={() => window.location.reload()}>Reload</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{values.title || "Untitled draft"}</h1>
        <SaveIndicator state={saveState} />
      </div>

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="features">Amenities & features</TabsTrigger>
          <TabsTrigger value="photos">Photos ({mediaSorted.length})</TabsTrigger>
          <TabsTrigger value="video">Video{video ? (video.state === "processing" ? " (processing)" : video.state === "ready" ? " (1)" : " (failed)") : ""}</TabsTrigger>
          <TabsTrigger value="documents">Documents ({listing.documents.length})</TabsTrigger>
          <TabsTrigger value="preview">Preview & submit</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-5">
          <Card><CardContent className="space-y-5 pt-6">
            <Controller name="title" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" value={field.value ?? ""} onChange={field.onChange} maxLength={120} placeholder="e.g. 5-acre coffee estate near Madikeri with stream" />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )} />
            <Controller name="description" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" value={field.value ?? ""} onChange={field.onChange} rows={6} maxLength={5000} />
                <p className="text-xs text-muted-foreground">Describe the property without exact addresses, directions, map links or contact details.</p>
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller name="property_type" control={form.control} render={({ field }) => (
                <Field>
                  <FieldLabel>Property type</FieldLabel>
                  <Select value={field.value ?? ""} onValueChange={(v) => { if (v) field.onChange(v); }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )} />
              <Controller name="seller_type" control={form.control} render={({ field }) => (
                <Field>
                  <FieldLabel>Seller type</FieldLabel>
                  <Select value={field.value ?? ""} onValueChange={(v) => { if (v) field.onChange(v); }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{SELLER_TYPES.map((t) => <SelectItem key={t} value={t}>{SELLER_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller name="price" control={form.control} render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="price">Price (₹)</FieldLabel>
                  <Input id="price" inputMode="decimal" value={field.value ?? ""} onChange={field.onChange} placeholder="25000000" />
                  {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : <p className="text-xs text-muted-foreground">{formatPriceFull(field.value)}</p>}
                </Field>
              )} />
              <div className="flex items-end pb-2.5">
                <Controller name="negotiable" control={form.control} render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox id="negotiable" checked={field.value ?? false} onCheckedChange={(c) => field.onChange(c === true)} />
                    <Label htmlFor="negotiable" className="font-normal">Price is negotiable</Label>
                  </div>
                )} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller name="area_value" control={form.control} render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="area_value">Area</FieldLabel>
                  <Input id="area_value" inputMode="decimal" value={field.value ?? ""} onChange={field.onChange} placeholder="5" />
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )} />
              <Controller name="area_unit" control={form.control} render={({ field }) => (
                <Field>
                  <FieldLabel>Unit</FieldLabel>
                  <Select value={field.value ?? ""} onValueChange={(v) => { if (v) field.onChange(v); }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>{AREA_UNITS.map((u) => <SelectItem key={u} value={u}>{AREA_UNIT_LABELS[u].many}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )} />
            </div>
            {values.area_value && values.area_unit && <p className="text-sm text-muted-foreground">{formatArea(values.area_value, values.area_unit)}</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="location" className="space-y-5">
          <Card><CardContent className="space-y-5 pt-6">
            <Controller name="location_id" control={form.control} render={({ field }) => (
              <Field>
                <FieldLabel>General area shown to buyers</FieldLabel>
                <Select value={field.value ?? ""} onValueChange={(v) => { if (v) field.onChange(v); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select a general area" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )} />
            <Controller name="address_text" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="address">Exact address (private — for our team only)</FieldLabel>
                <Textarea id="address" value={field.value ?? ""} onChange={field.onChange} rows={3} maxLength={300} />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )} />
            <p className="text-sm text-muted-foreground">Buyers see only the general area. Land in Coorg coordinates enquiries and shares directions when arranging a site visit.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-5">
          <fieldset disabled={featuresSaving || submitting} className="space-y-5">
            <ListingDetailsEditor core={values} values={features}
              onCoreChange={(key, value) => form.setValue(key, value, { shouldDirty: true, shouldValidate: true })}
              onChange={(key, value) => {
                featuresDirtyRef.current = true;
                setFeatures((current) => ({ ...current, [key]: value }));
              }} />
          </fieldset>
          <Button onClick={async () => { if (await flush()) await saveFeatures(); }} disabled={featuresSaving || submitting}>
            {featuresSaving ? "Saving…" : "Save amenities & features"}
          </Button>
        </TabsContent>

        <TabsContent value="photos" className="space-y-5">
          <Card><CardContent className="space-y-4 pt-6">
            <div>
              <ul className="mb-4 grid gap-2 sm:grid-cols-3" aria-label="Photo requirements">
                <Requirement met={photos.count >= PHOTO_RULES.minPhotos} label={`At least ${PHOTO_RULES.minPhotos} photos`} detail={`${photos.count} added`} />
                <Requirement met={photos.portrait >= PHOTO_RULES.minPortrait} label="1 portrait photo" detail="3:4 or 9:16" />
                <Requirement met={photos.landscape >= PHOTO_RULES.minLandscape} label="1 landscape photo" detail="4:3 or 16:9" />
              </ul>
              <Label htmlFor="photo-input" className="mb-2 block font-normal text-muted-foreground">
                {PHOTO_RATIO_HINT}. JPEG, PNG or WebP, up to 10 MB each, 20 photos max.
              </Label>
              <Input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple
                onChange={(e) => { Array.from(e.target.files ?? []).forEach(uploadPhoto); e.target.value = ""; }} />
            </div>
            <UploadProgressList uploads={uploads} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {mediaSorted.map((m, i) => (
                <div key={m.id} className="space-y-2">
                  <div className="relative aspect-square overflow-hidden rounded-md border">
                    <PropertyImage src={mediaUrl(m.id, "thumb")} alt={m.alt_text ?? "Listing photo"} sizes="200px" />
                    {m.is_cover && <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground"><Star className="size-3" /> Cover</span>}
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-card/95 px-2 py-0.5 text-xs font-medium capitalize shadow-sm">
                      {photoOrientation(m.width, m.height)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <Button size="sm" variant="ghost" disabled={m.is_cover} onClick={() => reorder(mediaSorted.map((x) => x.id), m.id)} title="Set as cover"><Star className="size-4" /></Button>
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => reorder(swap(mediaSorted.map((x) => x.id), i, i - 1), mediaSorted.find((x) => x.is_cover)?.id ?? m.id)}>←</Button>
                    <Button size="sm" variant="ghost" disabled={i === mediaSorted.length - 1} onClick={() => reorder(swap(mediaSorted.map((x) => x.id), i, i + 1), mediaSorted.find((x) => x.is_cover)?.id ?? m.id)}>→</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { const r = await removeMediaAction({ mediaId: m.id }); if (r.error) toast.error(r.error.message); else router.refresh(); }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="video" className="space-y-5">
          <Card><CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              Optional. One video tour of up to 2 minutes (MP4, MOV or WebM, up to 500 MB, up to 4K). We convert it to
              1080p, 720p and 360p so buyers get fast, smooth playback on any connection.
            </p>

            {video?.state === "ready" && (
              <div className="space-y-3">
                <VideoTour
                  title={values.title || "this listing"}
                  src={videoUrl(video.id, "master.m3u8", true)}
                  posterUrl={videoUrl(video.id, "poster.jpg", true)}
                  durationSeconds={video.duration_seconds === null ? null : Number(video.duration_seconds)}
                  shortSide={video.width && video.height ? Math.min(video.width, video.height) : null}
                />
                <Button variant="destructive" size="sm" onClick={() => removeVideo(video.id)}>
                  <Trash2 /> Remove video
                </Button>
              </div>
            )}

            {video?.state === "processing" && (
              <Alert>
                <Loader2 className="animate-spin" />
                <AlertTitle>Processing your video</AlertTitle>
                <AlertDescription>
                  This usually takes a minute or two. You can keep editing; submit becomes available when it is done.
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => removeVideo(video.id)}>Cancel and remove</Button>
                </AlertDescription>
              </Alert>
            )}

            {video?.state === "failed" && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>This video could not be processed</AlertTitle>
                <AlertDescription>
                  {(video.error_code && VIDEO_ERROR_LABELS[video.error_code]) ?? VIDEO_ERROR_FALLBACK} Uploading a new video replaces it.
                </AlertDescription>
              </Alert>
            )}

            {(!video || video.state === "failed") && (
              <div>
                <Label htmlFor="video-input" className="mb-2 block font-normal text-muted-foreground">
                  Walk buyers through the land: entrance, boundaries, views, water and road access.
                </Label>
                <Input id="video-input" type="file" accept="video/mp4,video/quicktime,video/webm" className="max-w-sm"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ""; }} />
              </div>
            )}
            <UploadProgressList uploads={uploads} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-5">
          <Card><CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">Ownership and legal documents, reviewed privately. Never shown to buyers.</p>
            <div className="flex flex-wrap items-end gap-3">
              <Field className="w-56">
                <FieldLabel>Document type</FieldLabel>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="max-w-xs"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(f); e.target.value = ""; }} />
            </div>
            <UploadProgressList uploads={uploads} />
            <ul className="divide-y">
              {listing.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</span>
                  <Button size="sm" variant="ghost" onClick={async () => { const r = await removeDocumentAction({ documentId: d.id }); if (r.error) toast.error(r.error.message); else router.refresh(); }}><Trash2 className="size-4 text-destructive" /></Button>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Ready to submit?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1.5 text-sm">
                {Object.entries(SUBMISSION_GAP_LABELS).filter(([k]) => k !== "uploads_in_progress" && k !== "video_processing").map(([key, label]) => (
                  <li key={key} className="flex items-center gap-2">
                    {gaps.includes(key) ? <X className="size-4 text-destructive" /> : <Check className="size-4 text-success" />}
                    <span className={gaps.includes(key) ? "text-muted-foreground" : ""}>{label}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit for review"}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function swap(ids: string[], a: number, b: number): string[] {
  const next = [...ids];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>;
  if (state === "error") return <span className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="size-3.5" /> Couldn&rsquo;t save</span>;
  return <span data-testid="save-state" className="flex items-center gap-1.5 text-sm text-success"><Check className="size-3.5" /> Saved</span>;
}

function UploadProgressList({ uploads }: { uploads: UploadRow[] }) {
  if (uploads.length === 0) return null;
  return (
    <ul className="space-y-2">
      {uploads.map((u) => (
        <li key={u.id} className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground"><span className="truncate">{u.name}</span>
            <span>{u.status === "finalizing" ? "Processing…" : u.status === "error" ? u.error : `${u.progress}%`}</span>
          </div>
          <Progress value={u.status === "finalizing" ? 100 : u.progress} className={u.status === "error" ? "[&>div]:bg-destructive" : undefined} />
        </li>
      ))}
    </ul>
  );
}

function Requirement({ met, label, detail }: { met: boolean; label: string; detail: string }) {
  return (
    <li className={cn("flex items-center gap-2 rounded-md border p-3 text-sm", met ? "border-success/30 bg-success/5" : "bg-card")}>
      {met ? <Check className="size-4 shrink-0 text-success" aria-hidden="true" /> : <X className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="sr-only">{met ? "done" : "missing"}</span>
    </li>
  );
}
