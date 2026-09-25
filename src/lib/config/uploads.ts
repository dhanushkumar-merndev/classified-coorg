// Upload limits. PROPOSED values (GAP-03/GAP-11) pending Product sign-off;
// the database receives the per-listing counts from here so there is a single
// source of truth.

const MiB = 1024 * 1024;

export const IMAGE_LIMITS = {
  maxBytes: 10 * MiB,
  /** Decompression-bomb guard for sharp. */
  maxInputPixels: 40_000_000,
  // Minimum dimensions and orientation rules: src/lib/media/photo-rules.ts
  maxPerListing: 20,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  fullMaxEdge: 1600,
  thumbMaxEdge: 480,
} as const;

export const DOCUMENT_LIMITS = {
  maxBytes: 15 * MiB,
  maxPerListing: 10,
  acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  imageMaxEdge: 3000,
} as const;

export const DOCUMENT_TYPES = [
  "title_deed",
  "rtc",
  "encumbrance_certificate",
  "khata",
  "tax_receipt",
  "survey_sketch",
  "conversion_order",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const UPLOAD_TIMING = {
  /** Lifetime of the presigned PUT URL. */
  uploadUrlTtlSeconds: 600,
  /** Session lifetime: upload window plus time to finalize. */
  sessionTtlSeconds: 1800,
  /** Processing lease; long enough to download, validate and re-encode. */
  leaseSeconds: 120,
} as const;

/** Public approved-photo cache lifetime (continue.md §25 initial 300 s).
 *  Also the worst-case time a removed listing's photo stays in shared caches. */
export const PUBLIC_MEDIA_MAX_AGE_SECONDS = 300;
