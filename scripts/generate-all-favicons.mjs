import sharp from "sharp";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

async function main() {
  console.log("=== Generating Multi-Variant Favicons with White Background ===");

  const logoPath = "public/logo-on-light.png";
  if (!existsSync(logoPath)) {
    throw new Error(`Logo file not found at ${logoPath}`);
  }

  // 1. Remove old mountain icon.svg from src/app/ so it does not conflict
  if (existsSync("src/app/icon.svg")) {
    unlinkSync("src/app/icon.svg");
    console.log("✓ Removed outdated src/app/icon.svg");
  }

  // Helper to create an icon on a white background
  async function createFavicon(size, { isRounded = true, paddingRatio = 0.12 } = {}) {
    const rx = isRounded ? Math.round(size * 0.18) : 0;
    const svgBg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="#ffffff"/></svg>`;
    const bg = await sharp(Buffer.from(svgBg)).png().toBuffer();

    const logoSize = Math.max(12, Math.round(size * (1 - paddingRatio * 2)));
    const resizedLogo = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: "contain" })
      .toBuffer();

    return await sharp(bg)
      .composite([{
        input: resizedLogo,
        top: Math.round((size - logoSize) / 2),
        left: Math.round((size - logoSize) / 2),
      }])
      .png()
      .toBuffer();
  }

  // Generate PNG variants
  const f16 = await createFavicon(16, { isRounded: true, paddingRatio: 0.08 });
  const f32 = await createFavicon(32, { isRounded: true, paddingRatio: 0.10 });
  const f48 = await createFavicon(48, { isRounded: true, paddingRatio: 0.12 });
  const f180 = await createFavicon(180, { isRounded: false, paddingRatio: 0.14 }); // Apple recommends square (OS adds rounded mask)
  const f192 = await createFavicon(192, { isRounded: true, paddingRatio: 0.12 });
  const f512 = await createFavicon(512, { isRounded: true, paddingRatio: 0.12 });

  // Save PNG files to public/ and src/app/
  writeFileSync("public/favicon-16x16.png", f16);
  writeFileSync("public/favicon-32x32.png", f32);
  writeFileSync("public/apple-touch-icon.png", f180);
  writeFileSync("public/icon-192.png", f192);
  writeFileSync("public/icon-512.png", f512);

  writeFileSync("src/app/icon.png", f32);
  writeFileSync("src/app/apple-icon.png", f180);
  console.log("✓ Generated all PNG variants in public/ and src/app/");

  // Save temporary PNGs for multi-resolution .ico generation
  writeFileSync(".scratch/ico-16.png", f16);
  writeFileSync(".scratch/ico-32.png", f32);
  writeFileSync(".scratch/ico-48.png", f48);

  // Generate real multi-resolution favicon.ico (16, 32, 48) using magick/convert
  try {
    execSync("magick .scratch/ico-16.png .scratch/ico-32.png .scratch/ico-48.png public/favicon.ico");
  } catch {
    execSync("convert .scratch/ico-16.png .scratch/ico-32.png .scratch/ico-48.png public/favicon.ico");
  }

  // Also copy to src/app/favicon.ico
  execSync("cp public/favicon.ico src/app/favicon.ico");
  console.log("✓ Generated multi-resolution favicon.ico in public/ and src/app/");

  console.log("✅ All favicon variants created successfully!");
}

main().catch(console.error);
