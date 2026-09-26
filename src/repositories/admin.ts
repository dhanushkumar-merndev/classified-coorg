import "server-only";
import { ADMIN_ROLES, requireActor } from "@/lib/auth/dal";
import { getOptionalPropertyVideos } from "@/repositories/optional-videos";
import { getPrivatePropertyLocation } from "@/repositories/private-location";
import type { PropertyStatus } from "@/lib/domain/property-lifecycle";
import { fromDatabaseError } from "@/lib/errors";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";
import { DASHBOARD_PAGE_SIZE } from "@/repositories/account";

// admin_notes has no client grant, so it is read with the service role, only
// from admin-gated pages. Admin reads otherwise run with the admin's own session: RLS (app.is_admin) and the
// admin_* SECURITY DEFINER functions authorize; nothing here uses the service role.

function range(page: number) {
  const p = Math.max(1, Math.min(page, 400));
  const from = (p - 1) * DASHBOARD_PAGE_SIZE;
  return { page: p, from, to: from + DASHBOARD_PAGE_SIZE - 1 };
}

export interface AdminSummary {
  status_counts: Partial<Record<PropertyStatus, number>>;
  listed: number;
  users: { total: number; active: number; suspended: number };
  enquiries: { total: number; today: number };
  by_location: Array<{ name: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
  funnel_90d: { submitted: number; reviewed: number; approved: number; enquired: number };
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const { data, error } = await (await createSessionClient()).rpc("admin_dashboard_summary");
  if (error) throw fromDatabaseError(error);
  return data as AdminSummary;
}

export type TrendMetric = "listings_created" | "listings_approved" | "enquiries";

/** One grouped query server-side; the range is capped in the database. */
export async function getAdminTrend(metric: TrendMetric, from: string, to: string, bucket: "day" | "week" | "month" = "day") {
  const { data, error } = await (await createSessionClient()).rpc("admin_trend", {
    p_metric: metric, p_bucket: bucket, p_from: from, p_to: to,
  });
  if (error) throw fromDatabaseError(error);
  return (data ?? []) as Array<{ bucket: string; count: number }>;
}

export interface AdminListingRow {
  id: string; slug: string; title: string | null; status: PropertyStatus; featured: boolean;
  version: number; price: number | null; updated_at: string; published_at: string | null;
  owner: { full_name: string | null } | null;
}

export async function listAdminProperties(opts: { page: number; status?: PropertyStatus; q?: string; queue?: boolean }) {
  const { page, from, to } = range(opts.page);
  let query = (await createSessionClient())
    .from("properties")
    .select("id, slug, title, status, featured, version, price, updated_at, published_at, owner:profiles!properties_owner_id_fkey(full_name)", { count: "exact" })
    .is("deleted_at", null);
  if (opts.queue) query = query.in("status", ["submitted", "under_review"]);
  else if (opts.status) query = query.eq("status", opts.status);
  if (opts.q) query = query.ilike("title", `%${opts.q.replace(/[%_,()]/g, " ").trim()}%`);
  const { data, error, count } = await query
    .order(opts.queue ? "updated_at" : "updated_at", { ascending: !!opts.queue })
    .order("id").range(from, to);
  if (error) throw fromDatabaseError(error);
  const total = count ?? 0;
  return { items: (data ?? []) as unknown as AdminListingRow[], total, page, pageCount: Math.ceil(total / DASHBOARD_PAGE_SIZE) };
}

export async function getReviewDetail(id: string) {
  await requireActor({ anyRole: ADMIN_ROLES });
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createSessionClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select(`id, slug, owner_id, status, version, current_revision_id, featured, title, description, property_type, seller_type,
      price, negotiable, area_value, area_unit, road_access, water_available, electricity_available, updated_at,
      location:locations(name),
      owner:profiles!properties_owner_id_fkey(full_name, phone, email, user_type),
      media:property_media(id, sort_order, is_cover, alt_text),
      documents:property_documents(id, document_type, mime_type, original_filename),
      features:property_features(feature_key, feature_value)`)
    .eq("id", id).is("deleted_at", null)
    .is("media.removed_at", null).is("documents.removed_at", null)
    .order("sort_order", { referencedTable: "media" })
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!property) return null;
  const [history, notes, location, video] = await Promise.all([
    supabase.from("property_status_history").select("id, from_status, to_status, action, reason, created_at").eq("property_id", id)
      .order("created_at", { ascending: false }).limit(30),
    createServiceClient().from("admin_notes").select("id, note, created_at").eq("entity_type", "property").eq("entity_id", id)
      .order("created_at", { ascending: false }).limit(30),
    getPrivatePropertyLocation(id),
    getOptionalPropertyVideos(supabase, id),
  ]);
  return { property: { ...property, video, address_text: location?.address_text ?? null }, history: history.data ?? [], notes: notes.data ?? [] };
}

export interface AdminUserRow {
  id: string; full_name: string | null; phone: string | null; user_type: string;
  is_suspended: boolean; created_at: string; user_roles: Array<{ role_id: number }>;
}

export async function listAdminUsers(page: number, q?: string) {
  const r = range(page);
  let query = (await createSessionClient())
    .from("profiles")
    .select("id, full_name, phone, user_type, is_suspended, created_at, user_roles!user_roles_user_id_fkey(role_id)", { count: "exact" })
    .is("deleted_at", null);
  if (q) {
    const term = q.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(r.from, r.to);
  if (error) throw fromDatabaseError(error);
  const total = count ?? 0;
  return { items: (data ?? []) as unknown as AdminUserRow[], total, page: r.page, pageCount: Math.ceil(total / DASHBOARD_PAGE_SIZE) };
}

export interface AdminLocation {
  id: string; parent_id: string | null; type: string; name: string; slug: string; seo_title: string | null;
  seo_description: string | null; intro: string | null; is_active: boolean; sort_order: number;
}

/** Includes inactive locations; the public cached list only shows active ones. */
export async function listAdminLocations(): Promise<AdminLocation[]> {
  const { data, error } = await createServiceClient()
    .from("locations")
    .select("id, parent_id, type, name, slug, seo_title, seo_description, intro, is_active, sort_order")
    .order("sort_order").order("name").limit(500);
  if (error) throw fromDatabaseError(error);
  return data ?? [];
}

export interface AdminArticle {
  id: string; slug: string; title: string; excerpt: string | null; body: string | null;
  status: "draft" | "published" | "archived"; seo_title: string | null; seo_description: string | null; updated_at: string;
}

export async function listAdminArticles(page: number) {
  const r = range(page);
  const { data, error, count } = await (await createSessionClient())
    .from("articles")
    .select("id, slug, title, excerpt, body, status, seo_title, seo_description, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false }).order("id").range(r.from, r.to);
  if (error) throw fromDatabaseError(error);
  const total = count ?? 0;
  return { items: (data ?? []) as AdminArticle[], total, page: r.page, pageCount: Math.ceil(total / DASHBOARD_PAGE_SIZE) };
}

export interface AdminEnquiryRow {
  id: string; status: "new" | "read" | "closed"; message: string | null; created_at: string;
  property: { title: string | null; slug: string } | null;
  buyer: { full_name: string | null; phone: string | null } | null;
  seller: { full_name: string | null; phone: string | null } | null;
}

export async function listAdminEnquiries(page: number, status?: string) {
  const r = range(page);
  let query = (await createSessionClient())
    .from("enquiries")
    .select(`id, status, message, created_at, property:properties(title, slug),
      buyer:profiles!enquiries_buyer_id_fkey(full_name, phone), seller:profiles!enquiries_seller_id_fkey(full_name, phone)`, { count: "exact" });
  if (status === "new" || status === "read" || status === "closed") query = query.eq("status", status);
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(r.from, r.to);
  if (error) throw fromDatabaseError(error);
  const total = count ?? 0;
  return { items: (data ?? []) as unknown as AdminEnquiryRow[], total, page: r.page, pageCount: Math.ceil(total / DASHBOARD_PAGE_SIZE) };
}

export interface AuditRow {
  id: number; action: string; entity_type: string; entity_id: string | null; created_at: string;
  metadata: Record<string, unknown>; actor: { full_name: string | null } | null;
}

/** Super-admin only (GAP-05); callers must have checked the role. */
export async function listAuditLogs(page: number, action?: string) {
  const r = range(page);
  let query = createServiceClient()
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, metadata, actor:profiles!audit_logs_actor_id_fkey(full_name)", { count: "exact" });
  if (action) query = query.ilike("action", `${action.replace(/[%_,()]/g, "")}%`);
  const { data, error, count } = await query.order("id", { ascending: false }).range(r.from, r.to);
  if (error) throw fromDatabaseError(error);
  const total = count ?? 0;
  return { items: (data ?? []) as unknown as AuditRow[], total, page: r.page, pageCount: Math.ceil(total / DASHBOARD_PAGE_SIZE) };
}
