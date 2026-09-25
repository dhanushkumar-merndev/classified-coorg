// Listing photo rules (product decision 2026-09-25). Shared by the browser
// pre-upload check, the listing editor checklist and server-side processing.
// The submission check in SQL (app.property_submission_gaps) mirrors
// minPhotos / orientationRatio — keep both in sync.

export const PHOTO_RULES = {
  minPhotos: 4,
  minPortrait: 1,
  minLandscape: 1,
  /** Long side ÷ short side at or above this counts as portrait/landscape. */
  orientationRatio: 1.2,
  minLongEdge: 1200,
  minShortEdge: 800,
} as const;

export const PHOTO_RATIO_HINT = "Landscape 4:3 or 16:9 (at least 1200 × 800 px) · Portrait 3:4 or 9:16 (at least 800 × 1200 px)";

export type Orientation = "landscape" | "portrait" | "square";

export function photoOrientation(width: number, height: number): Orientation {
  if (width >= height * PHOTO_RULES.orientationRatio) return "landscape";
  if (height >= width * PHOTO_RULES.orientationRatio) return "portrait";
  return "square";
}

/** Human-readable reason a photo is too small, or null when it is fine. */
export function photoSizeProblem(width: number, height: number): string | null {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (long < PHOTO_RULES.minLongEdge || short < PHOTO_RULES.minShortEdge) {
    return `Too small (${width} × ${height} px). Use at least 1200 × 800 px for landscape or 800 × 1200 px for portrait.`;
  }
  return null;
}

export function photoSummary(photos: Array<{ width: number; height: number }>) {
  const portrait = photos.filter((p) => photoOrientation(p.width, p.height) === "portrait").length;
  const landscape = photos.filter((p) => photoOrientation(p.width, p.height) === "landscape").length;
  const gaps: string[] = [];
  if (photos.length < PHOTO_RULES.minPhotos) gaps.push("photos");
  if (portrait < PHOTO_RULES.minPortrait) gaps.push("photo_portrait");
  if (landscape < PHOTO_RULES.minLandscape) gaps.push("photo_landscape");
  return { count: photos.length, portrait, landscape, gaps };
}
