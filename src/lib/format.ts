// Display formatting. Money and area arrive from the database as decimal
// strings or numbers; formatting never feeds back into stored values.

const IST = "Asia/Kolkata";

const fullInr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** "₹2.5 Cr", "₹48 L", "₹75,000". Indian lakh/crore convention. */
export function formatPriceShort(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Price on request";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Price on request";
  if (n >= 1e7) return `₹${trimNumber(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trimNumber(n / 1e5)} L`;
  return fullInr.format(n);
}

/** "₹2,50,00,000" */
export function formatPriceFull(value: number | string | null | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? fullInr.format(n) : "Price on request";
}

function trimNumber(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, "");
}

export const AREA_UNIT_LABELS: Record<string, { one: string; many: string; short: string }> = {
  sqft: { one: "sq ft", many: "sq ft", short: "sq ft" },
  sqm: { one: "sq m", many: "sq m", short: "sq m" },
  cent: { one: "cent", many: "cents", short: "cent" },
  guntha: { one: "guntha", many: "guntha", short: "guntha" },
  acre: { one: "acre", many: "acres", short: "acre" },
  hectare: { one: "hectare", many: "hectares", short: "ha" },
};

export function formatArea(value: number | string | null | undefined, unit: string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !unit || !AREA_UNIT_LABELS[unit]) return "Area not specified";
  const label = n === 1 ? AREA_UNIT_LABELS[unit].one : AREA_UNIT_LABELS[unit].many;
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(n)} ${label}`;
}

/** "₹50 L / acre" */
export function formatPricePerUnit(value: number | string | null | undefined, unit: string | null | undefined): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !unit || !AREA_UNIT_LABELS[unit]) return null;
  return `${formatPriceShort(n)} / ${AREA_UNIT_LABELS[unit].short}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: IST,
  }).format(new Date(value));
}

/** "3 days ago" style, falling back to a date after a month. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const diff = now.getTime() - new Date(value).getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 30 * day) return `${Math.floor(diff / day)} days ago`;
  return formatDate(value);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}
