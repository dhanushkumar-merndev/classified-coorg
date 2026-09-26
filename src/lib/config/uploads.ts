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

// Listing video tour (product decision 2026-09-26): one per listing, up to two
// minutes. Transcoding runs in Vercel functions (1 vCPU, 300 s on Hobby), so
// the work is split into short time chunks, each a separate invocation; see
// src/services/video.service.ts.
export const VIDEO_LIMITS = {
  maxBytes: 500 * MiB,
  maxDurationSeconds: 120,
  /** Container durations are rounded; this much over the limit still passes. */
  durationToleranceSeconds: 2,
  /** Limits on the short side, after rotation (portrait 1080×1920 is 1080p).
   *  4K sources are accepted and delivered at up to 1080p. */
  maxShortSide: 2160,
  minShortSide: 240,
  maxLongSide: 4096,
  /** Higher frame rates are encoded at this rate. */
  maxFps: 30,
  maxPerListing: 1,
  acceptedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
} as const;

/** HLS quality ladder, best first. Rungs above the source's short side are
 *  skipped (never upscaled). */
export const VIDEO_LADDER = [
  { name: "1080p", shortSide: 1080, maxrateKbps: 5000 },
  { name: "720p", shortSide: 720, maxrateKbps: 2800 },
  { name: "360p", shortSide: 360, maxrateKbps: 800 },
] as const;

export const VIDEO_AUDIO_KBPS = 128;

export const VIDEO_TIMING = {
  /** Route maxDuration for the job endpoint (Vercel Hobby maximum). */
  jobMaxDurationSeconds: 300,
  /** Each encode job covers this much of the video (a multiple of the
   *  segment length). Measured on one core: a 24 s chunk of 1080p HDR takes
   *  under a minute, far inside the function limit. */
  chunkSeconds: 24,
  /** For sources above 1080p30 (4K, 60 fps), which cost more to decode. */
  heavyChunkSeconds: 12,
  segmentSeconds: 4,
  /** ffmpeg is stopped here, leaving time to upload and record the result. */
  encodeTimeoutSeconds: 200,
  probeTimeoutSeconds: 60,
  /** Longer than the function limit, so a live job is never re-claimed. */
  jobLeaseSeconds: 320,
  maxAttempts: 2,
  /** Presigned segment URLs inside a served playlist. */
  segmentUrlTtlSeconds: 6 * 60 * 60,
  /** A queued job nobody picked up after this long is started again. */
  stalledAfterSeconds: 45,
  /** Daily sweep: a video still processing after this long is failed. */
  stuckAfterSeconds: 6 * 60 * 60,
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

/** Cache-Control for public media whose URL names immutable bytes (photo and
 *  poster ids never change content). Browsers keep them a year; shared
 *  caches (CDN) only for PUBLIC_MEDIA_MAX_AGE_SECONDS, so removal freshness
 *  is unchanged. A browser that already viewed a photo gains nothing new. */
export const PUBLIC_IMMUTABLE_MEDIA_CACHE =
  `public, max-age=31536000, immutable, s-maxage=${PUBLIC_MEDIA_MAX_AGE_SECONDS}`;
