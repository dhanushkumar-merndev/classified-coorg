import { describe, expect, test } from "vitest";
import { isValidOtp, maskPhone, normalizeAuthPhone, normalizePhone } from "@/lib/auth/phone";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { fromDatabaseError } from "@/lib/errors";
import { redact } from "@/lib/logger";
import { findUnsafePdfFeatures, sanitizeFilename, sniffFileType } from "@/lib/storage/file-validation";
import { propertyDraftPatchSchema } from "@/schemas/property.schema";
import { TRANSITIONS, availableActions, findTransition } from "@/lib/domain/property-lifecycle";

describe("phone normalization (AUTH-002)", () => {
  test.each([
    "9876543210",
    "98765 43210",
    "098765-43210",
    "+91 98765 43210",
    "+919876543210",
    "+91-98765-43210",
  ])("%s resolves to one E.164 value", (input) => {
    expect(normalizePhone(input)).toBe("+919876543210");
  });

  test.each([
    "",
    "12345",
    "98765432101234",
    "98765abc10",
    "+1 415 555 2671", // unsupported country
    "+91 22 2345 6789", // Indian landline
    "1234567890",
    "+919876543210; drop table",
    null,
    9876543210,
  ])("%s is rejected before any SMS", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  test("Supabase-stored phones (no plus) normalize the same way", () => {
    expect(normalizeAuthPhone("919876543210")).toBe("+919876543210");
  });

  test("OTP keeps leading zeros and exact length (AUTH-003)", () => {
    expect(isValidOtp("012345")).toBe(true);
    for (const bad of ["12345", "1234567", "12 345", "abcdef", 123456, ""]) expect(isValidOtp(bad)).toBe(false);
  });

  test("masking hides the middle digits", () => {
    expect(maskPhone("+919876543210")).toBe("+91•••••••210");
  });
});

describe("post-login redirect (AUTH-007)", () => {
  test.each([
    ["/dashboard/saved?tab=2", "/dashboard/saved?tab=2"],
    ["/property/coffee-estate-abc", "/property/coffee-estate-abc"],
    ["/%2F%2Fevil.example", "/%2F%2Fevil.example"],
  ])("%s is kept", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  test.each([
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/login?next=/admin",
    "/api/auth/sms-hook",
    "/ok\nSet-Cookie:x",
    "x".repeat(600),
    undefined,
  ])("%s falls back", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });
});

describe("file identity from bytes (MEDIA-003)", () => {
  const bytes = (...values: number[]) => Uint8Array.from(values);
  const text = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));

  test("recognizes allowed signatures only", () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffFileType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffFileType(text("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffFileType(text("GIF89a"))).toBeNull();
    expect(sniffFileType(text("<html><script>"))).toBeNull();
    expect(sniffFileType(bytes())).toBeNull();
  });

  test("flags active, embedded and encrypted PDF content, including hex-escaped names", () => {
    expect(findUnsafePdfFeatures(text("%PDF-1.7 /Type /Catalog /Pages 2 0 R"))).toEqual([]);
    expect(findUnsafePdfFeatures(text("%PDF-1.7 /OpenAction << /S /JavaScript /JS (app.alert(1)) >>")).sort())
      .toEqual(["JS", "JavaScript"]);
    expect(findUnsafePdfFeatures(text("%PDF-1.4 /J#61vaScript"))).toEqual(["JavaScript"]);
    expect(findUnsafePdfFeatures(text("%PDF-1.4 /Encrypt 5 0 R"))).toEqual(["Encrypt"]);
    expect(findUnsafePdfFeatures(text("%PDF-1.4 /Launch /EmbeddedFile")).sort()).toEqual(["EmbeddedFile", "Launch"]);
  });

  test("filenames lose paths, control and header characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename('C:\\docs\\rtc"\r\n.pdf')).toBe("rtc.pdf");
    expect(sanitizeFilename("...")).toBeNull();
  });
});

describe("error mapping", () => {
  test("only allowlisted database codes pass through", () => {
    expect(fromDatabaseError({ code: "P0001", message: "VERSION_CONFLICT", details: "7" })).toMatchObject({
      code: "VERSION_CONFLICT", status: 409, detail: "7",
    });
    expect(fromDatabaseError({ code: "P0001", message: "RATE_LIMITED", details: "42" })).toMatchObject({
      code: "RATE_LIMITED", status: 429, retryAfterSeconds: 42,
    });
    const unknown = fromDatabaseError({ code: "23505", message: 'duplicate key value violates "profiles_pkey"' });
    expect(unknown).toMatchObject({ code: "INTERNAL", status: 500 });
    expect(unknown.message).not.toContain("profiles");
    expect(fromDatabaseError({ code: "42501", message: "permission denied for table x" }).code).toBe("FORBIDDEN");
  });
});

describe("log redaction (architecture §27)", () => {
  test("removes secrets, tokens and signed URL parameters", () => {
    const out = JSON.stringify(redact({
      otp: "123456",
      authkey: "k",
      nested: { access_token: "t", note: "url https://t3.storage.dev/b/k?X-Amz-Signature=abc&X-Amz-Credential=cred" },
      header: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
    }));
    for (const secret of ["123456", '"k"', '"t"', "abc", "cred", "eyJhbGci"]) expect(out).not.toContain(secret);
  });
});

describe("draft schema (ROLE-004, DB-004)", () => {
  test("rejects privileged and unknown fields", () => {
    for (const field of ["status", "owner_id", "featured", "published_at", "verification_status", "id"]) {
      expect(propertyDraftPatchSchema.safeParse({ [field]: "x" }).success, field).toBe(false);
    }
  });

  test("money and area are exact decimal strings", () => {
    expect(propertyDraftPatchSchema.parse({ price: "25000000.50", area_value: "2.5" }))
      .toEqual({ price: "25000000.50", area_value: "2.5" });
    for (const price of ["0", "-1", "1e9", "12,00,000", "1.234", "NaN", "Infinity"]) {
      expect(propertyDraftPatchSchema.safeParse({ price }).success, price).toBe(false);
    }
  });

  test("blank optional text clears to null", () => {
    expect(propertyDraftPatchSchema.parse({ title: "   " })).toEqual({ title: null });
  });
});

describe("lifecycle table", () => {
  test("every transition is unique per (from, action, actor)", () => {
    const keys = TRANSITIONS.map((t) => `${t.from}|${t.action}|${t.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("reviews are admin-only and submission owner-only", () => {
    expect(findTransition("under_review", "approve", "owner")).toBeUndefined();
    expect(findTransition("draft", "submit", "admin")).toBeUndefined();
    expect(availableActions("verified", "owner")).toEqual(["mark_sold"]);
  });
});
