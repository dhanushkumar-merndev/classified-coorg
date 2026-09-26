import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const IMAGES_DIR = resolve("public/images");
const GUIDES_DIR = resolve("public/images/guides");
mkdirSync(IMAGES_DIR, { recursive: true });
mkdirSync(GUIDES_DIR, { recursive: true });

const IMAGES_TO_FETCH = [
  {
    // Coorg at Kote Betta, Sreenadh TC — Unsplash License. See public/images/CREDITS.md.
    path: resolve(IMAGES_DIR, "hero-coorg-landscape.webp"),
    url: "https://images.unsplash.com/photo-1585640036119-ce2bf9c502d8?w=2400&q=85&auto=format&fit=crop",
    width: 2400,
    height: 1600,
  },
  {
    path: resolve(GUIDES_DIR, "guide-documents.webp"),
    url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1200&q=80&auto=format&fit=crop", // legal document, deed, pen
    width: 1200,
    height: 800,
  },
  {
    path: resolve(GUIDES_DIR, "guide-measurements.webp"),
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80&auto=format&fit=crop", // rolling green acreage
    width: 1200,
    height: 800,
  },
  {
    path: resolve(GUIDES_DIR, "guide-coffee-estate.webp"),
    url: "https://images.unsplash.com/photo-1515694590185-73647ba02c10?w=1200&q=80&auto=format&fit=crop", // ripe red coffee cherries
    width: 1200,
    height: 800,
  },
  {
    path: resolve(GUIDES_DIR, "guide-conversion.webp"),
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80&auto=format&fit=crop", // agricultural green landscape & sky
    width: 1200,
    height: 800,
  },
  {
    path: resolve(GUIDES_DIR, "guide-site-visit.webp"),
    url: "https://images.unsplash.com/photo-1573812188649-de34d2324878?w=1200&q=80&auto=format&fit=crop", // aerial plantation ridge and walking path
    width: 1200,
    height: 800,
  },
];

async function main() {
  console.log("Preparing hero & guide images...");
  for (const item of IMAGES_TO_FETCH) {
    try {
      console.log(`Fetching ${item.path}...`);
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf)
        .resize(item.width, item.height, { fit: "cover", position: "centre" })
        .webp({ quality: 85 })
        .toFile(item.path);
      console.log(`Saved ${item.path}`);
    } catch (e) {
      console.error(`Failed ${item.path}:`, e.message);
    }
  }
  console.log("Done preparing images!");
}

main();
