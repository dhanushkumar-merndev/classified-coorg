import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@/lib/logger";
import { createPublicClient } from "@/lib/supabase/server";
import { getListingBySlug, getFeaturedListings, type ListingDetail } from "./public-listings";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/supabase/server", () => ({ createPublicClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn<typeof fetch>();
const listing: Omit<ListingDetail, "video"> = {
  id: "8ec3f0fe-b31c-4dad-95a5-e65814e67aec",
  slug: "coffee-estate-near-madikeri",
  title: "Coffee estate near Madikeri",
  description: "An established coffee estate with road and water access.",
  property_type: "coffee_estate",
  listing_type: "sale",
  seller_type: "owner",
  price: 25000000,
  negotiable: false,
  area_value: 5,
  area_unit: "acre",
  price_per_unit: 5000000,
  road_access: true,
  water_available: true,
  electricity_available: true,
  featured: false,
  published_at: "2026-09-26T00:00:00.000Z",
  updated_at: "2026-09-26T00:00:00.000Z",
  location: null,
  media: [],
  features: [],
};

function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function request(index: number) {
  const [input, options] = fetchMock.mock.calls[index]!;
  return { url: new URL(String(input)), headers: new Headers(options?.headers) };
}

function databaseError(code: string, message: string) {
  return { code, message, details: null, hint: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.mocked(createPublicClient).mockReturnValue(createClient("https://supabase.example.test", "test-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  }));
});

describe("public listing detail", () => {
  test.each([
    databaseError("PGRST205", "Could not find the table 'public.property_videos' in the schema cache"),
    databaseError("42P01", 'relation "public.property_videos" does not exist'),
  ])("keeps a listing readable when the optional video table is missing ($code)", async (error) => {
    respond([listing]);
    respond(error, 404);

    await expect(getListingBySlug(listing.slug)).resolves.toEqual({ kind: "found", listing: { ...listing, video: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(request(0).url.searchParams.get("select")).not.toContain("property_videos");
    expect(logger.warn).toHaveBeenCalled();
  });

  test("loads a ready tour using anonymous, listing-specific visibility filters", async () => {
    const video = { id: "fe275b54-dbab-4b73-9b7f-604260fa844f", duration_seconds: 47.5, width: 1280, height: 720 };
    respond([listing]);
    respond([video]);

    await expect(getListingBySlug(listing.slug)).resolves.toEqual({ kind: "found", listing: { ...listing, video: [video] } });
    const videoRequest = request(1);
    expect(videoRequest.url.pathname).toBe("/rest/v1/property_videos");
    expect(videoRequest.url.searchParams.get("property_id")).toBe(`eq.${listing.id}`);
    expect(videoRequest.url.searchParams.get("removed_at")).toBe("is.null");
    expect(videoRequest.url.searchParams.get("state")).toBe("eq.ready");
    expect(videoRequest.url.searchParams.get("limit")).toBe("1");
    expect(videoRequest.url.searchParams.get("select")).toBe("id,duration_seconds,width,height");
    expect(videoRequest.headers.get("apikey")).toBe("test-anon-key");
    expect(videoRequest.headers.get("authorization")).toBe("Bearer test-anon-key");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("a listing without a ready video still renders", async () => {
    respond([listing]);
    respond([]);

    await expect(getListingBySlug(listing.slug)).resolves.toEqual({ kind: "found", listing: { ...listing, video: [] } });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test.each([
    databaseError("42501", "permission denied for table property_videos"),
    databaseError("PGRST205", "Could not find the table 'public.property_media' in the schema cache"),
  ])("does not hide unrelated video query failures ($code: $message)", async (error) => {
    respond([listing]);
    respond(error, 403);

    const result = getListingBySlug(listing.slug);
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toMatchObject({ cause: error });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("a core listing error remains an error and never starts a video lookup", async () => {
    const error = databaseError("42501", "permission denied for table properties");
    respond(error, 403);

    const result = getListingBySlug(listing.slug);
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toMatchObject({ cause: error });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a missing listing checks slug history without a video lookup", async () => {
    respond([]);
    respond([]);

    await expect(getListingBySlug("missing-listing")).resolves.toEqual({ kind: "missing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(request(1).url.pathname).toBe("/rest/v1/property_slug_history");
    expect(request(1).url.searchParams.get("old_slug")).toBe("eq.missing-listing");
  });

  test("an old slug still redirects without a video lookup", async () => {
    respond([]);
    respond([{ property: { slug: listing.slug } }]);

    await expect(getListingBySlug("old-estate-name")).resolves.toEqual({ kind: "redirect", slug: listing.slug });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(request(1).url.pathname).toBe("/rest/v1/property_slug_history");
  });

  test("invalid slugs do not query the database", async () => {
    await expect(getListingBySlug("../../private")).resolves.toEqual({ kind: "missing" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPublicClient).not.toHaveBeenCalled();
  });
});

 test("cards expose a watch link only for ready public tours", async () => {
  respond([{ ...listing, cover: [] }]);
  respond([{ property_id: listing.id }]);
  const cards = await getFeaturedListings(6);
  expect(cards[0]?.hasVideo).toBe(true);
  expect(request(1).url.searchParams.get("state")).toBe("eq.ready");
  expect(request(1).url.searchParams.get("removed_at")).toBe("is.null");
  expect(request(1).url.searchParams.get("property_id")).toBe(`in.(${listing.id})`);
});
