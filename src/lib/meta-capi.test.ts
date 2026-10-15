import { describe, expect, test } from "vitest";
import { buildMetaEvent } from "@/lib/meta-capi";

const base = {
  event: "Login" as const,
  eventId: "evt-1",
  eventTime: 1_760_000_000,
  sourceUrl: "https://landincoorg.com/login",
};

describe("Meta CAPI event payload", () => {
  test("hashes phone digits and user ID, passes browser identifiers as-is", () => {
    const event = buildMetaEvent({
      ...base,
      phone: "+91 98765 43210",
      userId: "00000000-0000-4000-8000-000000000001",
      userAgent: "Mozilla/5.0",
      ip: "203.0.113.7",
      fbp: "fb.1.1700000000000.123",
      fbc: "fb.1.1700000000000.abc",
      params: { new_user: true },
    });
    expect(event).toEqual({
      event_name: "Login",
      event_id: "evt-1",
      event_time: 1_760_000_000,
      action_source: "website",
      event_source_url: "https://landincoorg.com/login",
      user_data: {
        client_user_agent: "Mozilla/5.0",
        client_ip_address: "203.0.113.7",
        fbp: "fb.1.1700000000000.123",
        fbc: "fb.1.1700000000000.abc",
        // sha256("919876543210") and sha256 of the user ID.
        ph: "92b5072176e723878b5e06ff3ca61898e4eb74e8c46642a0f2db800b17364ab0",
        external_id: "11e594f481958c10e3015d0bf0447a22f068a8a647f475df15ce2c7ab4b8f3f1",
      },
      custom_data: { new_user: true },
    });
  });

  test("omits absent identifiers and empty custom data", () => {
    const event = buildMetaEvent({ ...base, userAgent: "Mozilla/5.0", ip: null, fbp: undefined, phone: null, params: {} });
    expect(event.user_data).toEqual({ client_user_agent: "Mozilla/5.0" });
    expect(event).not.toHaveProperty("custom_data");
  });
});
