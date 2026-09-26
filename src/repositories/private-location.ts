import "server-only";
import { ADMIN_ROLES, hasAnyRole, requireActor } from "@/lib/auth/dal";
import { fromDatabaseError } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/server";

/** Exact location is only available through authorized server-side reads. */
export async function getPrivatePropertyLocation(propertyId: string) {
  const actor = await requireActor();
  let query = createServiceClient().from("properties")
    .select("address_text, latitude, longitude")
    .eq("id", propertyId).is("deleted_at", null);
  if (!hasAnyRole(actor, ADMIN_ROLES)) query = query.eq("owner_id", actor.id);
  const { data, error } = await query.maybeSingle();
  if (error) throw fromDatabaseError(error);
  return data as { address_text: string | null; latitude: number | null; longitude: number | null } | null;
}
