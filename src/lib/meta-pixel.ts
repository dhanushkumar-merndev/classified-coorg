// Meta (Facebook) Pixel helpers for client components. The pixel is off when
// NEXT_PUBLIC_META_PIXEL_ID is unset, and every call here is then a no-op.
//
// Each event carries an event ID. When the Conversions API is added, send the
// same event server-side with that ID as `event_id` and Meta counts it once.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/** Seller funnel, in order. Custom events: build custom conversions on them
 *  in Events Manager to optimise ads for a step. */
export type PixelEvent =
  | "ListPropertyClick" // "List a property" on the promo modal
  | "Login" //             OTP verified, session created
  | "StartListing" //      new-listing form: type chosen, draft created
  | "SubmitListing"; //    listing submitted for review

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

/** Sends one funnel event and returns its event ID (for Conversions API
 *  deduplication). Pass `eventId` when the server must know it up front. */
export function trackPixel(event: PixelEvent, params: Record<string, unknown> = {}, eventId: string = crypto.randomUUID()): string {
  if (META_PIXEL_ID) window.fbq?.("trackCustom", event, params, { eventID: eventId });
  return eventId;
}
