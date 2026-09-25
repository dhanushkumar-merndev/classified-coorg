export const SITE_NAME = "Land in Coorg";
export const SITE_TAGLINE = "Verified local property marketplace for Coorg";
export const SITE_DESCRIPTION =
  "Find verified land, coffee estates, plots and homes across Coorg (Kodagu). Every listing is reviewed before it goes live.";

/** Canonical origin without trailing slash. */
export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") || path === "" ? path : `/${path}`}`;
}

export function mediaUrl(mediaId: string, variant: "full" | "thumb" = "full"): string {
  return `/media/${mediaId}/${variant}`;
}

export function propertyPath(slug: string): string {
  return `/property/${slug}`;
}

/** Land in Coorg's own line for buyers (broker model: buyers call the
 *  platform, never the seller). E.164 without spaces, e.g. "+919876543210".
 *  Call / WhatsApp buttons render only when this is set. */
export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "";

export function contactLinks(message?: string): { tel: string; whatsapp: string; display: string } | null {
  if (!/^\+\d{10,15}$/.test(CONTACT_PHONE)) return null;
  const digits = CONTACT_PHONE.slice(1);
  return {
    tel: `tel:${CONTACT_PHONE}`,
    whatsapp: `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`,
    display: CONTACT_PHONE.startsWith("+91") ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : CONTACT_PHONE,
  };
}
