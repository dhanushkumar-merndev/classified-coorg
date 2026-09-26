// Content checks on actual bytes (STOR-005, MEDIA-003, DOC-004). The declared
// Content-Type and file extension are never trusted.

export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

/** ffmpeg demuxer for an uploaded video, from its magic bytes. The transcoder
 *  forces this demuxer, so an upload can never be read as a playlist, concat
 *  list or other format that references further URLs or local files. */
export type VideoContainer = "mov" | "matroska";

export function sniffVideoContainer(bytes: Uint8Array): VideoContainer | null {
  // ISO BMFF (MP4, MOV, 3GP): a leading box of a known type.
  if (bytes.length >= 12 && ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(ascii(bytes, 4, 8))) {
    return "mov";
  }
  // EBML header (WebM, Matroska).
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "matroska";
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

// PDF name tokens that can execute, launch, embed or hide content. Names may
// be hex-escaped (/J#61vaScript), so escapes are decoded before matching.
const UNSAFE_PDF_NAMES = ["JavaScript", "JS", "Launch", "EmbeddedFile", "RichMedia", "XFA", "Encrypt"];

/**
 * PROPOSED policy (GAP-11): reject encrypted PDFs and PDFs with active or
 * embedded content. This scans uncompressed structure only; names inside
 * compressed object streams are not visible here, which is why documents are
 * also always served as sandboxed attachments from a private no-store route.
 */
export function findUnsafePdfFeatures(bytes: Uint8Array): string[] {
  const text = Buffer.from(bytes).toString("latin1");
  const found = new Set<string>();
  for (const match of text.matchAll(/\/([A-Za-z0-9#]{1,40})/g)) {
    const name = match[1].replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
    if (UNSAFE_PDF_NAMES.includes(name)) found.add(name);
  }
  return [...found];
}

/** Safe display filename: basename only, no control/path/quote characters. */
export function sanitizeFilename(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const base = input.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : null;
}
