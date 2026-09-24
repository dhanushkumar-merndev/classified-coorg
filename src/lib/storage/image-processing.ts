import "server-only";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { DOCUMENT_LIMITS, IMAGE_LIMITS } from "@/lib/config/uploads";

// Re-encodes validated bytes into new images (MEDIA-001/007). Decoding and
// re-encoding strips EXIF/GPS and any trailing payload; orientation is
// applied first so nothing is rotated wrongly after metadata removal.

sharp.cache(false);
sharp.concurrency(1);

export interface ProcessedListingImage {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

function decoder(bytes: Buffer) {
  return sharp(bytes, { limitInputPixels: IMAGE_LIMITS.maxInputPixels, failOn: "error", animated: false });
}

async function inspect(bytes: Buffer) {
  try {
    const meta = await decoder(bytes).metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format) || !meta.width || !meta.height) {
      throw new AppError("UNSUPPORTED_MEDIA_TYPE");
    }
    // Dimensions after EXIF orientation.
    const rotated = (meta.orientation ?? 1) >= 5;
    return { width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("UPLOAD_REJECTED", { detail: "unreadable_image", cause: error });
  }
}

export async function processListingImage(bytes: Buffer): Promise<ProcessedListingImage> {
  const { width, height } = await inspect(bytes);
  if (width < IMAGE_LIMITS.minWidth || height < IMAGE_LIMITS.minHeight) {
    throw new AppError("UPLOAD_REJECTED", { detail: "image_too_small" });
  }
  try {
    const full = await decoder(bytes)
      .rotate()
      .resize({ width: IMAGE_LIMITS.fullMaxEdge, height: IMAGE_LIMITS.fullMaxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await decoder(bytes)
      .rotate()
      .resize({ width: IMAGE_LIMITS.thumbMaxEdge, height: IMAGE_LIMITS.thumbMaxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return { full: full.data, thumb, width: full.info.width, height: full.info.height };
  } catch (error) {
    throw new AppError("UPLOAD_REJECTED", { detail: "image_processing_failed", cause: error });
  }
}

/** Scanned document pages: keep legibility, drop metadata. */
export async function processDocumentImage(bytes: Buffer): Promise<Buffer> {
  await inspect(bytes);
  try {
    return await decoder(bytes)
      .rotate()
      .resize({ width: DOCUMENT_LIMITS.imageMaxEdge, height: DOCUMENT_LIMITS.imageMaxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (error) {
    throw new AppError("UPLOAD_REJECTED", { detail: "image_processing_failed", cause: error });
  }
}
