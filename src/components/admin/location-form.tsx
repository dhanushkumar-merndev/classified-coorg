"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveLocationAction } from "@/actions/admin-content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toSlug } from "@/lib/labels";
import type { AdminLocation } from "@/repositories/admin";

const TYPES = ["district", "taluk", "town", "village", "area"] as const;
const NONE = "none";

export function LocationForm({ location, all }: { location?: AdminLocation; all: AdminLocation[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    name: location?.name ?? "", slug: location?.slug ?? "", type: location?.type ?? "town", parentId: location?.parent_id ?? NONE,
    seoTitle: location?.seo_title ?? "", seoDescription: location?.seo_description ?? "", intro: location?.intro ?? "",
    isActive: location?.is_active ?? true, sortOrder: String(location?.sort_order ?? 0),
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  const save = () => start(async () => {
    const r = await saveLocationAction({
      id: location?.id, name: v.name, slug: v.slug, type: v.type, parentId: v.parentId === NONE ? null : v.parentId,
      seoTitle: v.seoTitle, seoDescription: v.seoDescription, intro: v.intro, isActive: v.isActive, sortOrder: Number(v.sortOrder) || 0,
    });
    if (r.error) toast.error(r.error.detail === "slug" ? "That slug is already used" : r.error.message);
    else { toast.success("Location saved"); setOpen(false); router.refresh(); }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {location ? <Button size="sm" variant="outline">Edit</Button> : <Button><Plus /> Add location</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{location ? "Edit location" : "Add location"}</DialogTitle>
          <DialogDescription>Shown on the public locations pages when active.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={v.name} onChange={(e) => { set("name", e.target.value); if (!location) set("slug", toSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))); }} /></div>
          <div className="grid gap-2"><Label htmlFor="loc-slug">Slug</Label><Input id="loc-slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label>Type</Label>
              <Select value={v.type} onValueChange={(x) => set("type", x)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Parent</Label>
              <Select value={v.parentId} onValueChange={(x) => set("parentId", x)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>None</SelectItem>
                  {all.filter((l) => l.id !== location?.id).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="loc-seot">SEO title (max 70)</Label><Input id="loc-seot" maxLength={70} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="loc-seod">SEO description (max 170)</Label><Textarea id="loc-seod" maxLength={170} rows={2} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="loc-intro">Intro copy</Label><Textarea id="loc-intro" rows={5} maxLength={5000} value={v.intro} onChange={(e) => set("intro", e.target.value)} /></div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2"><Checkbox id="loc-active" checked={v.isActive} onCheckedChange={(c) => set("isActive", c === true)} /><Label htmlFor="loc-active" className="font-normal">Active</Label></div>
            <div className="flex items-center gap-2"><Label htmlFor="loc-sort" className="font-normal">Sort order</Label><Input id="loc-sort" className="w-24" inputMode="numeric" value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={pending || !v.name.trim() || !v.slug.trim()}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
