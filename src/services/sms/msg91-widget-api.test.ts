import { afterEach, describe, expect, it, vi } from "vitest";
import { widgetSendOtp, widgetVerifyOtp } from "./msg91-widget-api";

function answering(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
}

afterEach(() => vi.unstubAllGlobals());

describe("MSG91 widget REST API", () => {
  it("returns MSG91's access token for a correct code", async () => {
    answering(200, { type: "success", message: "eyJabc.def.ghi" });
    expect(await widgetVerifyOtp("w", "t", "req-123", "1234")).toEqual({ ok: true, accessToken: "eyJabc.def.ghi" });
  });

  it("treats a wrong code as rejected", async () => {
    answering(200, { type: "error", message: "OTP not match" });
    expect(await widgetVerifyOtp("w", "t", "req-123", "1234")).toEqual({ ok: false, reason: "rejected", message: "OTP not match" });
  });

  it("treats HTTP 429 and MSG91's own attempt limits as throttled, not an outage", async () => {
    answering(429, {});
    expect(await widgetVerifyOtp("w", "t", "req-123", "1234")).toMatchObject({ ok: false, reason: "throttled" });
    answering(200, { type: "error", message: "Max limit reached for this otp verification" });
    expect(await widgetVerifyOtp("w", "t", "req-123", "1234")).toMatchObject({ ok: false, reason: "throttled" });
    answering(200, { type: "error", message: "Resend limit exceeded" });
    expect(await widgetSendOtp("w", "t", "919876543210")).toMatchObject({ ok: false, reason: "throttled" });
  });

  it("reports outages as unavailable with the cause", async () => {
    answering(503, {});
    expect(await widgetVerifyOtp("w", "t", "req-123", "1234")).toEqual({ ok: false, reason: "unavailable", message: "http_error 503" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await widgetSendOtp("w", "t", "919876543210")).toEqual({ ok: false, reason: "unavailable", message: "network" });
  });
});
