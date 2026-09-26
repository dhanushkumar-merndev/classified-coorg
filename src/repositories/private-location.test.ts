import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireActor, type Actor } from "@/lib/auth/dal";
import { createServiceClient } from "@/lib/supabase/server";
import { getPrivatePropertyLocation } from "./private-location";

vi.mock("@/lib/auth/dal", () => ({
  ADMIN_ROLES: ["admin", "super_admin"],
  hasAnyRole: (actor: Actor, roles: string[]) => roles.some((role) => actor.roles.has(role as never)),
  requireActor: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
const fetchMock = vi.fn<typeof fetch>();
const actor: Actor = { id: "owner-123", phone: null, fullName: null, roles: new Set(["seller"]), isSuspended: false };

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.mocked(requireActor).mockResolvedValue(actor);
  vi.mocked(createServiceClient).mockReturnValue(createClient("https://supabase.example.test", "test-server-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchMock },
  }));
});
function respond(rows: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } }));
}

describe("authorized private location reads", () => {
  test("requires an active authenticated actor before creating a privileged client", async () => {
    vi.mocked(requireActor).mockRejectedValue(new Error("AUTH_REQUIRED"));
    await expect(getPrivatePropertyLocation("listing-123")).rejects.toThrow("AUTH_REQUIRED");
    expect(createServiceClient).not.toHaveBeenCalled();
  });
  test("scopes seller and buyer reads to their own listing", async () => {
    respond([]);
    await expect(getPrivatePropertyLocation("someone-elses-listing")).resolves.toBeNull();
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.searchParams.get("owner_id")).toBe("eq.owner-123");
    expect(url.searchParams.get("id")).toBe("eq.someone-elses-listing");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
  });
  test("permits the platform team to read a listing's location", async () => {
    vi.mocked(requireActor).mockResolvedValue({ ...actor, roles: new Set(["admin"]) });
    const location = { address_text: "Private address", latitude: 12.4, longitude: 75.7 };
    respond([location]);
    await expect(getPrivatePropertyLocation("listing-123")).resolves.toEqual(location);
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.searchParams.has("owner_id")).toBe(false);
    expect(url.searchParams.get("id")).toBe("eq.listing-123");
  });
});
