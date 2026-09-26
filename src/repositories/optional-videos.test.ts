import { createClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";
import { getOptionalPropertyVideos } from "./optional-videos";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
const client = (body: unknown, status = 200) => createClient("https://supabase.example.test", "test-session-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }) },
});

describe("optional editor/review video data", () => {
  test("keeps editing available when the video table is absent", async () => {
    const db = client({ code: "PGRST205", message: "Could not find the table 'public.property_videos' in the schema cache" }, 404);
    await expect(getOptionalPropertyVideos(db, "property-123")).resolves.toEqual([]);
  });
  test("keeps a processing tour visible to its editor", async () => {
    const video = { id: "video-123", state: "processing", error_code: null, duration_seconds: null, width: null, height: null };
    await expect(getOptionalPropertyVideos(client([video]), "property-123")).resolves.toEqual([video]);
  });
  test("does not suppress permission errors", async () => {
    const db = client({ code: "42501", message: "permission denied for table property_videos" }, 403);
    await expect(getOptionalPropertyVideos(db, "property-123")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
