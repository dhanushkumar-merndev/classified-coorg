import { randomBytes } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { beforeEach, describe, expect, test } from "vitest";
import { Msg91SmsProvider } from "./msg91";
import { handleSendSmsHook, type SendSmsHookDeps } from "./send-sms-hook";
import { SmsSendError, type SmsProvider } from "./sms-provider";

const base64Secret = randomBytes(32).toString("base64");
const hookSecret = `v1,whsec_${base64Secret}`;
const PHONE = "+919876543210";

function signed(payload: unknown, id = `msg_${randomBytes(6).toString("hex")}`, at = new Date()) {
  const body = JSON.stringify(payload);
  const signature = new Webhook(base64Secret).sign(id, at, body);
  return {
    body,
    headers: { "webhook-id": id, "webhook-timestamp": String(Math.floor(at.getTime() / 1000)), "webhook-signature": signature },
  };
}

const event = (otp = "012345", phone = "919876543210") => ({ user: { phone }, sms: { otp } });

class FakeSms implements SmsProvider {
  sent: Array<{ phone: string; otp: string }> = [];
  failWith: SmsSendError | null = null;
  async sendOtp(phone: string, otp: string) {
    if (this.failWith) throw this.failWith;
    this.sent.push({ phone, otp });
    return { providerMessageId: "req-1" };
  }
}

let sms: FakeSms;
let receipts: Set<string>;
let limits: Map<string, number>;
let logs: Array<{ event: string; fields: Record<string, unknown> }>;
let deps: SendSmsHookDeps;

beforeEach(() => {
  sms = new FakeSms();
  receipts = new Set();
  limits = new Map();
  logs = [];
  deps = {
    hookSecret,
    appEnv: "production",
    allowlist: new Set(),
    sms,
    registerReceipt: async (id) => (receipts.has(id) ? false : (receipts.add(id), true)),
    releaseReceipt: async (id) => void receipts.delete(id),
    consume: async (action, subject) => {
      const key = `${action}:${subject}`;
      const hits = (limits.get(key) ?? 0) + 1;
      limits.set(key, hits);
      const max = { otp_send_phone_cooldown: 1, otp_send_phone_hourly: 5, otp_send_phone_daily: 10 }[action];
      return { allowed: hits <= max, retryAfterSeconds: hits <= max ? 0 : 60 };
    },
    log: (e, fields) => logs.push({ event: e, fields }),
  };
});

describe("Supabase Send SMS hook (SMS-001/002/004/006/007)", () => {
  test("delivers the Supabase-issued code once, leading zeros intact, without logging it", async () => {
    const { body, headers } = signed(event("012345"));
    const res = await handleSendSmsHook(body, headers, deps);
    expect(res).toEqual({ status: 200, body: {} });
    expect(sms.sent).toEqual([{ phone: PHONE, otp: "012345" }]);
    expect(JSON.stringify(logs)).not.toContain("012345");
    expect(JSON.stringify(logs)).not.toContain("9876543210");
  });

  test("rejects missing, wrong, tampered and stale signatures without sending", async () => {
    const good = signed(event());
    const cases = [
      { body: good.body, headers: {} },
      { body: good.body, headers: { ...good.headers, "webhook-signature": "v1,AAAA" } },
      { body: good.body.replace("012345", "999999"), headers: good.headers },
      signed(event(), "msg_old", new Date(Date.now() - 60 * 60 * 1000)),
    ];
    for (const c of cases) {
      expect((await handleSendSmsHook(c.body, c.headers as Record<string, string>, deps)).status).toBe(401);
    }
    expect(sms.sent).toEqual([]);
  });

  test("a replayed event does not send again", async () => {
    const req = signed(event());
    await handleSendSmsHook(req.body, req.headers, deps);
    const replay = await handleSendSmsHook(req.body, req.headers, deps);
    expect(replay.status).toBe(200);
    expect(sms.sent).toHaveLength(1);
  });

  test("per-phone cooldown applies to every path into Auth, with retry time", async () => {
    const first = signed(event("111111"));
    const second = signed(event("222222"));
    expect((await handleSendSmsHook(first.body, first.headers, deps)).status).toBe(200);
    const blocked = await handleSendSmsHook(second.body, second.headers, deps);
    expect(blocked.status).toBe(429);
    expect(JSON.stringify(blocked.body)).toContain("60 seconds");
    expect(sms.sent).toHaveLength(1);
    // A denied resend did not also burn the hourly budget.
    expect(limits.get(`otp_send_phone_hourly:${PHONE}`)).toBe(1);
  });

  test("non-production only texts allowlisted numbers (SMS-006)", async () => {
    deps.appEnv = "staging";
    const req = signed(event());
    expect((await handleSendSmsHook(req.body, req.headers, deps)).status).toBe(403);
    deps.allowlist = new Set([PHONE]);
    const again = signed(event());
    expect((await handleSendSmsHook(again.body, again.headers, deps)).status).toBe(200);
  });

  test("unsupported numbers and malformed payloads are refused", async () => {
    for (const payload of [event("123456", "14155552671"), { user: {}, sms: { otp: "1" } }]) {
      const req = signed(payload);
      expect((await handleSendSmsHook(req.body, req.headers, deps)).status).toBe(400);
    }
    expect(sms.sent).toEqual([]);
  });

  test("definite failures free the receipt for a genuine retry; ambiguous ones do not", async () => {
    sms.failWith = new SmsSendError("transient", 503, "down");
    const req = signed(event());
    expect((await handleSendSmsHook(req.body, req.headers, deps)).status).toBe(502);
    expect(receipts.has(req.headers["webhook-id"])).toBe(false);

    limits.clear();
    sms.failWith = new SmsSendError("ambiguous", null, "timeout");
    const req2 = signed(event());
    expect((await handleSendSmsHook(req2.body, req2.headers, deps)).status).toBe(502);
    expect(receipts.has(req2.headers["webhook-id"])).toBe(true);
  });
});

describe("MSG91 response classification (SMS-003/004)", () => {
  const provider = (response: () => Promise<Response>) =>
    new Msg91SmsProvider({ authKey: "k", templateId: "t", otpVariable: "otp", fetchImpl: response as typeof fetch });

  test("success returns the request id and sends digits without plus", async () => {
    let sentBody = "";
    const p = new Msg91SmsProvider({
      authKey: "k", templateId: "tpl", otpVariable: "otp",
      fetchImpl: (async (_url: string, init: RequestInit) => {
        sentBody = String(init.body);
        return Response.json({ type: "success", message: "req-9" });
      }) as unknown as typeof fetch,
    });
    await expect(p.sendOtp(PHONE, "012345")).resolves.toEqual({ providerMessageId: "req-9" });
    expect(JSON.parse(sentBody)).toEqual({
      template_id: "tpl", short_url: "0", recipients: [{ mobiles: "919876543210", otp: "012345" }],
    });
  });

  test.each([
    ["200 with error type", () => Response.json({ type: "error", message: "bad template" }), "permanent"],
    ["401", () => new Response("no", { status: 401 }), "permanent"],
    ["429", () => new Response("slow", { status: 429 }), "transient"],
    ["503", () => new Response("down", { status: 503 }), "transient"],
    ["200 unreadable", () => new Response("<html>", { status: 200 }), "ambiguous"],
  ])("%s → %s", async (_label, make, kind) => {
    await expect(provider(async () => make()).sendOtp(PHONE, "1")).rejects.toMatchObject({ kind });
  });

  test("network timeout is ambiguous", async () => {
    await expect(provider(async () => { throw new DOMException("t", "TimeoutError"); }).sendOtp(PHONE, "1"))
      .rejects.toMatchObject({ kind: "ambiguous" });
  });
});
