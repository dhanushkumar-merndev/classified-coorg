"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveArticleAction } from "@/actions/admin-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminArticle } from "@/repositories/admin";

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

export function ArticleForm({ article }: { article?: AdminArticle }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    title: article?.title ?? "", slug: article?.slug ?? "", excerpt: article?.excerpt ?? "", body: article?.body ?? "",
    status: article?.status ?? "draft", seoTitle: article?.seo_title ?? "", seoDescription: article?.seo_description ?? "",
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  const save = () => start(async () => {
    const r = await saveArticleAction({ id: article?.id, ...v });
    if (r.error) toast.error(r.error.detail === "slug" ? "That slug is already used" : r.error.message);
    else { toast.success(v.status === "published" ? "Article published" : "Article saved"); setOpen(false); router.refresh(); }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {article ? <Button size="sm" variant="outline">Edit</Button> : <Button><Plus /> New article</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{article ? "Edit article" : "New article"}</DialogTitle>
          <DialogDescription>Plain text: a blank line between paragraphs, <code>## </code> starts a heading line, <code>- </code> starts a bullet.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="art-title">Title</Label>
            <Input id="art-title" maxLength={160} value={v.title} onChange={(e) => { set("title", e.target.value); if (!article) set("slug", slugify(e.target.value)); }} /></div>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="grid gap-2"><Label htmlFor="art-slug">Slug</Label><Input id="art-slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} /></div>
            <div className="grid gap-2"><Label>Status</Label>
              <Select value={v.status} onValueChange={(x) => set("status", x as typeof v.status)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="art-excerpt">Excerpt (max 400)</Label><Textarea id="art-excerpt" rows={2} maxLength={400} value={v.excerpt} onChange={(e) => set("excerpt", e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="art-body">Body</Label><Textarea id="art-body" rows={12} value={v.body} onChange={(e) => set("body", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="art-seot">SEO title (max 70)</Label><Input id="art-seot" maxLength={70} value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="art-seod">SEO description (max 170)</Label><Input id="art-seod" maxLength={170} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={pending || !v.title.trim() || !v.slug.trim()}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
