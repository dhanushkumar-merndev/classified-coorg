"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/api/response";
import { ADMIN_ROLES, requireActor } from "@/lib/auth/dal";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/repositories/public-listings";

// Locations and articles have no client write grants. Writes run with the
// service role only after the caller is confirmed as an admin, and each one
// is recorded in the append-only audit log.

const slugRule = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").max(100);
const optional = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();

const locationInput = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(100),
  slug: slugRule,
  type: z.enum(["district", "taluk", "town", "village", "area"]),
  parentId: z.uuid().nullable(),
  seoTitle: optional(70),
  seoDescription: optional(170),
  intro: optional(5000),
  isActive: z.boolean(),
  sortOrder: z.int().min(0).max(10000),
});

async function audit(actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
  const { error } = await createServiceClient().from("audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata });
  if (error) throw fromDatabaseError(error);
}

export async function saveLocationAction(input: unknown) {
  return runAction("admin.location.save", async () => {
    const actor = await requireActor({ anyRole: ADMIN_ROLES });
    const parsed = locationInput.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", { detail: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(",") });
    const v = parsed.data;
    const row = {
      name: v.name, slug: v.slug, type: v.type, parent_id: v.parentId, seo_title: v.seoTitle ?? null,
      seo_description: v.seoDescription ?? null, intro: v.intro ?? null, is_active: v.isActive, sort_order: v.sortOrder,
    };
    const db = createServiceClient();
    const { data, error } = v.id
      ? await db.from("locations").update(row).eq("id", v.id).select("id").single()
      : await db.from("locations").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") throw new AppError("VALIDATION_FAILED", { detail: "slug" });
      throw fromDatabaseError(error);
    }
    await audit(actor.id, v.id ? "location.update" : "location.create", "location", data.id, { slug: v.slug, active: v.isActive });
    revalidateTag(CACHE_TAGS.locations, { expire: 0 });
    revalidateTag(CACHE_TAGS.listings, { expire: 0 });
    revalidatePath("/admin/locations");
    return { id: data.id };
  });
}

const articleInput = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(160),
  slug: slugRule.max(120),
  excerpt: optional(400),
  body: optional(100000),
  status: z.enum(["draft", "published", "archived"]),
  seoTitle: optional(70),
  seoDescription: optional(170),
});

export async function saveArticleAction(input: unknown) {
  return runAction("admin.article.save", async () => {
    const actor = await requireActor({ anyRole: ADMIN_ROLES });
    const parsed = articleInput.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_FAILED", { detail: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(",") });
    const v = parsed.data;
    const db = createServiceClient();
    let publishedAt: string | null = null;
    if (v.status === "published") {
      const existing = v.id ? (await db.from("articles").select("published_at").eq("id", v.id).maybeSingle()).data : null;
      publishedAt = existing?.published_at ?? new Date().toISOString();
    }
    const row = {
      title: v.title, slug: v.slug, excerpt: v.excerpt ?? null, body: v.body ?? null, status: v.status,
      seo_title: v.seoTitle ?? null, seo_description: v.seoDescription ?? null, published_at: publishedAt,
      ...(v.id ? {} : { author_id: actor.id, author_name: actor.fullName }),
    };
    const { data, error } = v.id
      ? await db.from("articles").update(row).eq("id", v.id).select("id").single()
      : await db.from("articles").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") throw new AppError("VALIDATION_FAILED", { detail: "slug" });
      throw fromDatabaseError(error);
    }
    await audit(actor.id, v.id ? "article.update" : "article.create", "article", data.id, { slug: v.slug, status: v.status });
    revalidateTag(CACHE_TAGS.articles, { expire: 0 });
    revalidatePath("/admin/articles");
    revalidatePath("/guides");
    return { id: data.id };
  });
}
