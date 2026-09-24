import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

// GAP-03 PROPOSED: India mobile numbers only for MVP (MSG91 DLT templates).
export const SUPPORTED_COUNTRIES: readonly CountryCode[] = ["IN"];
export const OTP_LENGTH = 6;

/** Normalizes user input to E.164 (e.g. "+919876543210"), or null when the
 *  value is not a valid mobile number in a supported country (AUTH-002).
 *  Local ("98765 43210", "098765 43210") and international forms resolve to
 *  the same value. */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length < 8 || trimmed.length > 24) return null;
  // Only digits, spaces, dashes, dots, parentheses and one leading plus.
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return null;

  const parsed = parsePhoneNumberFromString(trimmed, "IN");
  if (!parsed || !parsed.isValid() || !parsed.country) return null;
  if (!SUPPORTED_COUNTRIES.includes(parsed.country)) return null;
  const type = parsed.getType();
  if (type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return null;
  return parsed.number;
}

/** Normalizes a phone as stored by Supabase Auth (digits, no "+"). */
export function normalizeAuthPhone(phone: string): string | null {
  return normalizePhone(phone.startsWith("+") ? phone : `+${phone}`);
}

export function isValidOtp(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

/** "+91•••••••210" for logs and UI. */
export function maskPhone(e164: string): string {
  return e164.length <= 6 ? "•••" : `${e164.slice(0, 3)}${"•".repeat(e164.length - 6)}${e164.slice(-3)}`;
}
