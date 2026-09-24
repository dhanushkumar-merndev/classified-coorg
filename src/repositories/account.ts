import "server-only";
import type { PropertyStatus } from "@/lib/domain/property-lifecycle";
import { fromDatabaseError } from "@/lib/errors";
import { createSessionClient } from "@/lib/supabase/server";

// Signed-in user's own data (dashboard). Every query runs with the user's
// session, so RLS limits results to the caller; lists are server-paginated.

export const DASHBOARD_PAGE_SIZE = 25;

function range(page: number) {
  const p = Math.max(1, Math.min(page, 400));
  const from = (p - 1) * DASHBOARD_PAGE_SIZE;
  return { page: p, from, to: from + DASHBOARD_PAGE_SIZE - 1 };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

function paged<T>(items: T[], total: number | null, page: number): Paged<T> {
  const t = total ?? 0;
  return { items, total: t, page, pageCount: Math.ceil(t / DASHBOARD_PAGE_SIZE) };
}

export async function getOverview(userId: string, isSeller: boolean) {
  const supabase = await createSessionClient();
  const head = { count: "exact" as const, head: true };
  const [saved, sent, received, statuses] = await Promise.all([
    supabase.from("favorites").select("property_id", head).eq("user_id", userId),
    supabase.from("enquiries").select("id", head).eq("buyer_id", userId),
    isSeller ? supabase.from("enquiries").select("id", head).eq("seller_id", userId).eq("status", "new") : Promise.resolve({ count: 0 }),
    isSeller ? supabase.rpc("my_listing_status_counts") : Promise.resolve({ data: [] }),
  ]);
  const byStatus: Partial<Record<PropertyStatus, number>> = {};
  for (const row of ((statuses as { data: unknown }).data ?? []) as Array<{ status: PropertyStatus; listings: number }>) {
    byStatus[row.status] = Number(row.listings);
  }
  return {
    saved: saved.count ?? 0,
    sentEnquiries: sent.count ?? 0,
    newReceived: received.count ?? 0,
    byStatus,
  };
}

export interface MyListing {
  id: string;
  slug: string;
  title: string | null;
  status: PropertyStatus;
  version: number;
  price: number | null;
  area_value: number | null;
  area_unit: string | null;
  updated_at: string;
  published_at: string | null;
  cover: Array<{ id: string }> | null;
}

export async function listMyListings(userId: string, pageNumber: number, status?: PropertyStatus): Promise<Paged<MyListing>> {
  const { page, from, to } = range(pageNumber);
  const supabase = await createSessionClient();
  let query = supabase
    .from("properties")
    .select("id, slug, title, status, version, price, area_value, area_unit, updated_at, published_at, cover:property_media(id)", { count: "exact" })
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .eq("cover.is_cover", true)
    .is("cover.removed_at", null);
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.order("updated_at", { ascending: false }).order("id").range(from, to);
  if (error) throw fromDatabaseError(error);
  return paged((data ?? []) as unknown as MyListing[], count, page);
}

export async function getEnquiryCounts(): Promise<Record<string, { total: number; unread: number }>> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("seller_enquiry_counts");
  if (error) throw fromDatabaseError(error);
  return Object.fromEntries(((data ?? []) as Array<{ property_id: string; total: number; unread: number }>)
    .map((r) => [r.property_id, { total: Number(r.total), unread: Number(r.unread) }]));
}

const PUBLIC_CARD = `id, slug, title, price, price_per_unit, area_value, area_unit, property_type, seller_type,
  listing_type, published_at, featured, location:locations(name, slug), cover:property_media(id, alt_text)`;

export async function listSaved(userId: string, pageNumber: number) {
  const { page, from, to } = range(pageNumber);
  const supabase = await createSessionClient();
  const { data, error, count } = await supabase
    .from("favorites")
    .select(`created_at, property_id, property:properties(${PUBLIC_CARD})`, { count: "exact" })
    .eq("user_id", userId)
    .eq("property.cover.is_cover", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw fromDatabaseError(error);
  return paged(data ?? [], count, page);
}

export async function listRecentlyViewed(userId: string) {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("recently_viewed")
    .select(`viewed_at, property_id, property:properties(${PUBLIC_CARD})`)
    .eq("user_id", userId)
    .eq("property.cover.is_cover", true)
    .order("viewed_at", { ascending: false })
    .limit(30);
  if (error) throw fromDatabaseError(error);
  return data ?? [];
}

export interface SentEnquiry {
  id: string;
  message: string | null;
  status: string;
  created_at: string;
  property: { title: string; slug: string } | null;
}

export async function listSentEnquiries(userId: string, pageNumber: number): Promise<Paged<SentEnquiry>> {
  const { page, from, to } = range(pageNumber);
  const supabase = await createSessionClient();
  const { data, error, count } = await supabase
    .from("enquiries")
    .select("id, message, status, created_at, property:properties(title, slug)", { count: "exact" })
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw fromDatabaseError(error);
  return paged((data ?? []) as unknown as SentEnquiry[], count, page);
}

export interface ReceivedEnquiry {
  id: string;
  property_id: string;
  property_title: string;
  property_slug: string;
  property_status: PropertyStatus;
  buyer_name: string | null;
  buyer_phone: string | null;
  message: string | null;
  status: "new" | "read" | "closed";
  created_at: string;
  total: number;
}

export async function listReceivedEnquiries(pageNumber: number, status?: "new" | "read" | "closed"): Promise<Paged<ReceivedEnquiry>> {
  const { page, from } = range(pageNumber);
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("list_received_enquiries", {
    p_status: status ?? null, p_limit: DASHBOARD_PAGE_SIZE, p_offset: from,
  });
  if (error) throw fromDatabaseError(error);
  const rows = (data ?? []) as ReceivedEnquiry[];
  return paged(rows, rows[0] ? Number(rows[0].total) : 0, page);
}

export async function getMyProfile(userId: string) {
  const supabase = await createSessionClient();
  const [{ data: profile, error }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email, user_type, created_at").eq("id", userId).single(),
    supabase.auth.getUser(),
  ]);
  if (error) throw fromDatabaseError(error);
  return { ...profile, pendingEmail: auth.user?.new_email ?? null };
}

export interface OwnListingDetail {
  id: string;
  slug: string;
  owner_id: string;
  status: PropertyStatus;
  version: number;
  current_revision_id: string | null;
  title: string | null;
  description: string | null;
  property_type: string | null;
  listing_type: string;
  seller_type: string | null;
  price: string | null;
  negotiable: boolean;
  area_value: string | null;
  area_unit: string | null;
  location_id: string | null;
  address_text: string | null;
  road_access: boolean | null;
  water_available: boolean | null;
  electricity_available: boolean | null;
  published_at: string | null;
  updated_at: string;
  location: { name: string; slug: string } | null;
  media: Array<{ id: string; sort_order: number; is_cover: boolean; alt_text: string | null; width: number; height: number }>;
  documents: Array<{ id: string; document_type: string; mime_type: string; original_filename: string | null; created_at: string }>;
  features: Array<{ id: string; feature_key: string; feature_value: string | null }>;
}

/** The owner's own listing for editing (RLS: owner or admin). */
export async function getOwnListing(listingId: string): Promise<OwnListingDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(listingId)) return null;
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("properties")
    .select(`id, slug, owner_id, status, version, current_revision_id, title, description, property_type, listing_type,
      seller_type, price, negotiable, area_value, area_unit, location_id, address_text, road_access, water_available,
      electricity_available, published_at, updated_at,
      location:locations(name, slug),
      media:property_media(id, sort_order, is_cover, alt_text, width, height),
      documents:property_documents(id, document_type, mime_type, original_filename, created_at),
      features:property_features(id, feature_key, feature_value)`)
    .eq("id", listingId)
    .is("deleted_at", null)
    .is("media.removed_at", null)
    .is("documents.removed_at", null)
    .order("sort_order", { referencedTable: "media" })
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) return null;
  // Price and area are handled as exact decimal strings in forms.
  const row = data as unknown as OwnListingDetail & { price: number | string | null; area_value: number | string | null };
  return { ...row, price: row.price === null ? null : String(row.price), area_value: row.area_value === null ? null : String(row.area_value) };
}

export async function getOwnerFeedback(listingId: string) {
  const supabase = await createSessionClient();
  const [{ data: reviews }, { data: history }] = await Promise.all([
    supabase.from("verification_reviews").select("id, decision, owner_message, created_at").eq("property_id", listingId)
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("property_status_history").select("id, from_status, to_status, action, reason, created_at").eq("property_id", listingId)
      .order("created_at", { ascending: false }).limit(20),
  ]);
  return { reviews: reviews ?? [], history: history ?? [] };
}
