import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromDatabaseError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Keep editing/review available while the optional video migration rolls out. */
export async function getOptionalPropertyVideos(client: SupabaseClient, propertyId: string) {
  const { data, error } = await client.from("property_videos")
    .select("id, state, error_code, duration_seconds, width, height")
    .eq("property_id", propertyId).is("removed_at", null).limit(1);
  if (error) {
    if (!["PGRST205", "42P01"].includes(error.code) || !/\bproperty_videos\b/.test(error.message)) {
      throw fromDatabaseError(error);
    }
    logger.warn("listing.video_schema_unavailable", { code: error.code, migration: "20260926000100_property_videos.sql" });
  }
  return data ?? [];
}
