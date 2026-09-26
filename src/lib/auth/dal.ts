import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { createSessionClient } from "@/lib/supabase/server";

// Data access layer for identity (Next.js authentication guide). Identity comes
// from a verified Supabase JWT; roles and suspension come from the database on
// every request, so a suspension or role removal applies to sessions that
// were issued earlier (AUTH-010, RLS-008, ROLE-005).

export type Role = "buyer" | "seller" | "agent" | "admin" | "super_admin";

// Fixed ids seeded by the core migration.
const ROLE_BY_ID: Record<number, Role> = { 1: "buyer", 2: "seller", 3: "agent", 4: "admin", 5: "super_admin" };

export interface Actor {
  id: string;
  phone: string | null;
  fullName: string | null;
  roles: ReadonlySet<Role>;
  isSuspended: boolean;
}

export const ADMIN_ROLES: readonly Role[] = ["admin", "super_admin"];
export const LISTING_ROLES: readonly Role[] = ["seller", "agent"];
export const ADMIN_ROLE_IDS: readonly number[] = Object.entries(ROLE_BY_ID)
  .filter(([, role]) => ADMIN_ROLES.includes(role))
  .map(([id]) => Number(id));

async function loadActor(): Promise<Actor | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const readProfile = () =>
    supabase.from("profiles").select("id, phone, full_name, is_suspended, deleted_at").eq("id", userId).maybeSingle();

  let { data: profile } = await readProfile();
  if (!profile) {
    // Auth identity without a profile (AUTH-012): provision idempotently with
    // least privilege, then read again.
    await supabase.rpc("ensure_profile");
    ({ data: profile } = await readProfile());
    if (!profile) return null;
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);
  if (rolesError) throw new AppError("DEPENDENCY_FAILED", { cause: rolesError });

  const isSuspended = profile.is_suspended || profile.deleted_at !== null;
  return {
    id: profile.id,
    phone: profile.phone,
    fullName: profile.full_name,
    isSuspended,
    roles: new Set(isSuspended ? [] : (roleRows ?? []).map((r) => ROLE_BY_ID[r.role_id]).filter(Boolean)),
  };
}

/** Current actor for this request, or null when signed out. Memoized per request. */
export const getActor = cache(loadActor);

export function hasAnyRole(actor: Actor, roles: readonly Role[]): boolean {
  return roles.some((role) => actor.roles.has(role));
}

/** For server actions and route handlers: throws AppError when the actor is
 *  missing, suspended or lacks every one of `anyRole`. */
export async function requireActor(options: { anyRole?: readonly Role[] } = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AppError("AUTH_REQUIRED");
  if (actor.isSuspended) throw new AppError("ACCOUNT_SUSPENDED");
  if (options.anyRole && !hasAnyRole(actor, options.anyRole)) throw new AppError("FORBIDDEN");
  return actor;
}

/** For pages and layouts: redirects to login when signed out, and renders
 *  404 (without revealing the area exists) when the role is missing. */
export async function requirePageActor(nextPath: string, options: { anyRole?: readonly Role[] } = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (actor.isSuspended) redirect("/account-suspended");
  if (options.anyRole && !hasAnyRole(actor, options.anyRole)) notFound();
  return actor;
}
