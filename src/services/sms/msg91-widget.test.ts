import { describe, expect, it, vi } from "vitest";
import { looksLikeAccessToken, verifyWidgetAccessToken } from "./msg91-widget";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: unknown) => `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("MSG91 widget token verification", () => {
  it("rejects anything that is not a JWT before calling MSG91", async () => {
    const fetchImpl = fetchReturning(200, { type: "success" });
    for (const bad of ["", "abc", "a.b", "a.b.c.d", "a b.c.d", "x".repeat(5000)]) {
      expect(looksLikeAccessToken(bad)).toBe(false);
      expect(await verifyWidgetAccessToken(bad, { authKey: "k", fetchImpl })).toEqual({ ok: false, reason: "malformed" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the authkey and token to MSG91 and treats type=error as rejected (HTTP 200)", async () => {
    const fetchImpl = fetchReturning(200, { message: "AuthenticationFailure", type: "error", code: "201" });
    const token = jwt({ mobile: "919876543210" });
    expect(await verifyWidgetAccessToken(token, { authKey: "secret", fetchImpl })).toEqual({ ok: false, reason: "rejected", answer: "AuthenticationFailure" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ authkey: "secret", "access-token": token });
  });

  it("maps outages and throttling to unavailable", async () => {
    const token = jwt({});
    expect(await verifyWidgetAccessToken(token, { authKey: "k", fetchImpl: fetchReturning(503, {}) })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyWidgetAccessToken(token, { authKey: "k", fetchImpl: fetchReturning(429, {}) })).toEqual({ ok: false, reason: "unavailable" });
    const throwing = vi.fn(async () => { throw new Error("network"); });
    expect(await verifyWidgetAccessToken(token, { authKey: "k", fetchImpl: throwing })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reads the verified phone from MSG91's message", async () => {
    const r = await verifyWidgetAccessToken(jwt({}), { authKey: "k", fetchImpl: fetchReturning(200, { type: "success", message: "919876543210" }) });
    expect(r).toMatchObject({ ok: true, phones: ["+919876543210"] });
  });

  it("falls back to phone claims inside the MSG91-accepted token", async () => {
    const token = jwt({ company: 1, data: { identifier: "919876543210" } });
    const r = await verifyWidgetAccessToken(token, { authKey: "k", fetchImpl: fetchReturning(200, { type: "success", message: "verified" }) });
    expect(r).toMatchObject({ ok: true, phones: ["+919876543210"] });
  });

  it("accepts padded standard-base64 tokens and finds phones nested deep in claims", async () => {
    const padded = `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64")}.${Buffer.from(JSON.stringify({ a: { b: { c: [{ mobile: 919876543210 }] } } })).toString("base64")}.sig=`;
    expect(looksLikeAccessToken(padded)).toBe(true);
    const r = await verifyWidgetAccessToken(padded, { authKey: "k", fetchImpl: fetchReturning(200, { type: "success", message: "ok" }) });
    expect(r).toMatchObject({ ok: true, phones: ["+919876543210"] });
  });

  it("finds a phone embedded in MSG91's text answer", async () => {
    const r = await verifyWidgetAccessToken(jwt({}), { authKey: "k", fetchImpl: fetchReturning(200, { type: "success", message: "verified 919876543210" }) });
    expect(r).toMatchObject({ ok: true, phones: ["+919876543210"] });
  });

  it("attests no phone when neither the answer nor the token carries one", async () => {
    const r = await verifyWidgetAccessToken(jwt({ sub: "abc" }), { authKey: "k", fetchImpl: fetchReturning(200, { type: "success", message: "OK" }) });
    expect(r).toMatchObject({ ok: true, phones: [] });
  });
});
