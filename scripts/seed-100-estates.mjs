#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env")) process.loadEnvFile(".env");

const TIGRIS_ENDPOINT = process.env.TIGRIS_STORAGE_ENDPOINT;
const TIGRIS_REGION = process.env.TIGRIS_STORAGE_REGION || "auto";
const TIGRIS_KEY = process.env.TIGRIS_STORAGE_ACCESS_KEY_ID;
const TIGRIS_SECRET = process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY;
const BUCKET_MEDIA = process.env.TIGRIS_BUCKET_MEDIA;
const BUCKET_DOCS = process.env.TIGRIS_BUCKET_DOCUMENTS;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!TIGRIS_KEY || !BUCKET_MEDIA || !SUPABASE_URL) {
  console.error("Missing Tigris or Supabase environment variables!");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: TIGRIS_ENDPOINT,
  region: TIGRIS_REGION,
  credentials: {
    accessKeyId: TIGRIS_KEY,
    secretAccessKey: TIGRIS_SECRET,
  },
});

const CACHE_DIR = resolve(".scratch/master-images");
const PUBLIC_IMG_DIR = resolve("public/dummy-estate-images");
mkdirSync(CACHE_DIR, { recursive: true });
mkdirSync(PUBLIC_IMG_DIR, { recursive: true });

// 36 Pristine, hand-verified coffee plantation & Western Ghats nature images (NO food, NO beaches, NO signs)
const MASTER_IMAGE_SOURCES = [
  // 22 Pure Landscapes (Coffee cherries, lush plantations, hills, streams, misty valleys)
  { id: "h28p96ICizo", rawUrl: "https://images.unsplash.com/photo-1515694590185-73647ba02c10", orientation: "landscape", title: "Ripening red and green coffee cherries on high altitude bush" },
  { id: "AgPj0maIEEs", rawUrl: "https://images.unsplash.com/photo-1633437805600-2c58bf56663c", orientation: "landscape", title: "Lush green coffee estate valley surrounded by mountain ranges" },
  { id: "p7xchIkJrJA", rawUrl: "https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0", orientation: "landscape", title: "Heavy clusters of coffee cherries on healthy estate trees" },
  { id: "_salGOxyB-I", rawUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09", orientation: "landscape", title: "Matured coffee cherries growing under shade trees" },
  { id: "ouob6k2zsLw", rawUrl: "https://images.unsplash.com/photo-1541447271487-09612b3f49f7", orientation: "landscape", title: "Rolling green coffee hillside with dense tree canopy" },
  { id: "FpsB7Jo8nHk", rawUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd", orientation: "landscape", title: "Organic coffee berries glistening in morning light" },
  { id: "1-ZUhMFleK0", rawUrl: "https://images.unsplash.com/photo-1746623691157-c4c7a3bad0c4", orientation: "landscape", title: "Farmer tending coffee bushes in fertile estate soil" },
  { id: "R5RDNgd82jw", rawUrl: "https://images.unsplash.com/photo-1646438596321-5cded1891b62", orientation: "landscape", title: "Deep evergreen silver oak forest canopy over coffee plants" },
  { id: "0IzOSa51T-Y", rawUrl: "https://images.unsplash.com/photo-1676921820173-33e5e4d20aee", orientation: "landscape", title: "Close up view of healthy coffee cherries ready for harvest" },
  { id: "ZGwVRqBSIvc", rawUrl: "https://images.unsplash.com/photo-1764620967387-7412a794202d", orientation: "landscape", title: "Branch laden with Arabica coffee cherries in various ripening stages" },
  { id: "dWUOvA4I6IE", rawUrl: "https://images.unsplash.com/photo-1788276363151-9edbb8129d0d", orientation: "landscape", title: "Cluster of ripe crimson coffee cherries with glossy green leaves" },
  { id: "ehlRsL_lAA8", rawUrl: "https://images.unsplash.com/photo-1773393766346-30cbf64b8e30", orientation: "landscape", title: "High-yield coffee branch with sweet ripe cherries" },
  { id: "vJhPgzIuriM", rawUrl: "https://images.unsplash.com/photo-1780147211998-55f3f9c9f74e", orientation: "landscape", title: "Thriving Robusta coffee plants with heavy berry load" },
  { id: "y-ZExrtpebw", rawUrl: "https://images.unsplash.com/photo-1774270203563-dc314232b590", orientation: "landscape", title: "Green coffee cherries maturing under filtered sunlight" },
  { id: "1bR36TUmnN8", rawUrl: "https://images.unsplash.com/photo-1764322667347-8df6314e3841", orientation: "landscape", title: "Lush green plantation foliage and developing coffee berries" },
  { id: "LfUo29lotsI", rawUrl: "https://images.unsplash.com/photo-1764322666888-56a0fdd7e2fd", orientation: "landscape", title: "Estate coffee bushes showing excellent foliage health" },
  { id: "W86F7VcRT3M", rawUrl: "https://images.unsplash.com/photo-1765990604870-fffd6d5f3961", orientation: "landscape", title: "Premium Arabica coffee cherries on mountain slope" },
  { id: "n-S_ZQdQOCg", rawUrl: "https://images.unsplash.com/photo-1783096549881-d5e62ce4354d", orientation: "landscape", title: "Coorg coffee shrubs intercropped with natural shade" },
  { id: "o0M2VZJPo34", rawUrl: "https://images.unsplash.com/photo-1779317180142-a48e20102c17", orientation: "landscape", title: "Yellow and green coffee cherries in progressive ripening" },
  { id: "f-6IMWJEzRU", rawUrl: "https://images.unsplash.com/photo-1603097148068-564d0158227e", orientation: "landscape", title: "Lush green meadow slope on estate edge with clear mountain air" },
  { id: "phgLWISjkVw", rawUrl: "https://images.unsplash.com/photo-1758390286386-87c9d78cf9be", orientation: "landscape", title: "Terraced plantation hillside overlooking panoramic Kodagu valley" },
  { id: "3QS2wAhNQLA", rawUrl: "https://images.unsplash.com/photo-1573812188649-de34d2324878", orientation: "landscape", title: "Aerial view of misty mountain range and dense forest cover" },

  // 14 Pure Portraits (Vertical estate paths, tall silver oaks, coffee shrubs, mountain vistas)
  { id: "vdSFR35uF4M", rawUrl: "https://images.unsplash.com/photo-1648483880685-356ea43870c9", orientation: "portrait", title: "Winding red-earth footpath through dense coffee plantation" },
  { id: "Sd5DeuU-OZE", rawUrl: "https://images.unsplash.com/photo-1750967613671-297f1b63038d", orientation: "portrait", title: "Vertical view of ripening coffee cherries on plantation shrub" },
  { id: "6GzV9uNUDS8", rawUrl: "https://images.unsplash.com/photo-1694558334826-a371e09fae1d", orientation: "portrait", title: "Healthy branch with bright red coffee berries and leaves" },
  { id: "ICAYc8e2pls", rawUrl: "https://images.unsplash.com/photo-1597816792530-f6d57bd2bf9e", orientation: "portrait", title: "Red coffee cherries ready for selective harvesting" },
  { id: "XaNosMXvIm8", rawUrl: "https://images.unsplash.com/photo-1693734656256-e589d44cbd30", orientation: "portrait", title: "Close up of healthy coffee fruits on bush" },
  { id: "pNzqwntGoDE", rawUrl: "https://images.unsplash.com/photo-1780355369153-5f12da22d462", orientation: "portrait", title: "Robusta coffee berries showing heavy yield on branch" },
  { id: "n-b54emtZ6E", rawUrl: "https://images.unsplash.com/photo-1729678426987-443dcb81fd2f", orientation: "portrait", title: "Natural water reservoir surrounded by tall plantation trees" },
  { id: "S1nGUR7bCaM", rawUrl: "https://images.unsplash.com/photo-1650884986392-984358536050", orientation: "portrait", title: "Dramatic mountain slope with lush green cultivation" },
  { id: "vnbT6mwJX9E", rawUrl: "https://images.unsplash.com/photo-1721823429242-d2969658bcf9", orientation: "portrait", title: "Emerald green estate field with mountain backdrop" },
  { id: "m6IWDlRiUOk", rawUrl: "https://images.unsplash.com/photo-1658122540870-5ce0e8332502", orientation: "portrait", title: "Western Ghats mountain ridge with tall shade canopy" },
  { id: "cw6vH7yEU7k", rawUrl: "https://images.unsplash.com/photo-1766671966028-618f17c3c51f", orientation: "portrait", title: "Rolling green plantation hills with distant mist-covered peaks" },
  { id: "UAKWw2xb5iM", rawUrl: "https://images.unsplash.com/photo-1764679396839-793cc84ad872", orientation: "portrait", title: "Estate hillside pathway winding through green trees" },
  { id: "Uf9fCeIaBEM", rawUrl: "https://images.unsplash.com/photo-1760884966322-207bd5afdd77", orientation: "portrait", title: "Planter residence cottage nestled in lush green estate" },
  { id: "ESWDHFPFvQ8", rawUrl: "https://images.unsplash.com/photo-1760884993296-5d3e0647396e", orientation: "portrait", title: "Estate buildings and drying yard surrounded by coffee hills" },
];

const LOCATIONS = [
  { id: "ff34fd7b-a166-4802-ab91-75c4ace8666f", name: "Madikeri", slug: "madikeri", lat: 12.4244, lng: 75.7382 },
  { id: "76a3d5ea-1770-48e6-9489-b0a6b6f89fb5", name: "Kushalnagar", slug: "kushalnagar", lat: 12.4555, lng: 75.9616 },
  { id: "ecfc4b44-b0a4-447d-bc12-630580261c61", name: "Virajpet", slug: "virajpet", lat: 12.2034, lng: 75.8032 },
  { id: "8354f226-252d-492a-ba0b-a4a674b99e69", name: "Somwarpet", slug: "somwarpet", lat: 12.5977, lng: 75.8647 },
  { id: "b08c11ff-bd3b-4946-8a04-3484e61e3732", name: "Gonikoppal", slug: "gonikoppal", lat: 12.1802, lng: 75.9271 },
  { id: "90ca4fbf-440b-4a85-aa7c-84ddd1919c04", name: "Suntikoppa", slug: "suntikoppa", lat: 12.4697, lng: 75.8344 },
  { id: "6ad48253-90b9-49a4-bcec-6cf7ec1419ab", name: "Boikere", slug: "boikere", lat: 12.4411, lng: 75.7891 },
  { id: "6275e383-21a4-491f-a025-bbf0f829c281", name: "Napoklu", slug: "napoklu", lat: 12.3389, lng: 75.6989 },
];

const SELLER_PROFILES = [
  { id: "c81a7975-d48a-495d-a554-11e650d283b2", type: "owner" },
  { id: "14676516-1633-48f0-9847-3df76e77dc71", type: "agent" },
];

// Reusable dummy PDF for land documents
const DUMMY_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n" +
  "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
  "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" +
  "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n" +
  "4 0 obj << /Length 135 >> stream\n" +
  "BT /F1 18 Tf 50 720 Td (Government of Karnataka - Revenue Department) Tj 0 -30 Td /F1 12 Tf (RTC / Record of Rights, Tenancy and Crops - Pahani Record) Tj ET\n" +
  "endstream endobj\n" +
  "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n" +
  "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000431 00000 n \n" +
  "trailer << /Size 6 /Root 1 0 R >>\nstartxref\n508\n%%EOF\n"
);
const DUMMY_PDF_CHECKSUM = crypto.createHash("sha256").update(DUMMY_PDF_BYTES).digest("hex");

async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// 1. Download & process master images
async function prepareMasterImages() {
  console.log(`\n=== Preparing ${MASTER_IMAGE_SOURCES.length} Pure Coffee & Estate Master Images ===`);
  const masterImages = [];

  for (let i = 0; i < MASTER_IMAGE_SOURCES.length; i++) {
    const src = MASTER_IMAGE_SOURCES[i];
    const fullCachePath = resolve(CACHE_DIR, `img-v2-${i}-full.webp`);
    const thumbCachePath = resolve(CACHE_DIR, `img-v2-${i}-thumb.webp`);
    const metaCachePath = resolve(CACHE_DIR, `img-v2-${i}-meta.json`);

    let fullBuf, thumbBuf, meta;

    if (existsSync(fullCachePath) && existsSync(thumbCachePath) && existsSync(metaCachePath)) {
      fullBuf = readFileSync(fullCachePath);
      thumbBuf = readFileSync(thumbCachePath);
      meta = JSON.parse(readFileSync(metaCachePath, "utf8"));
    } else {
      process.stdout.write(`Fetching [${i + 1}/${MASTER_IMAGE_SOURCES.length}] ${src.id} (${src.orientation})... `);
      const isLandscape = src.orientation === "landscape";
      const w = isLandscape ? 1600 : 1000;
      const h = isLandscape ? 1067 : 1400;
      const url = `${src.rawUrl}?w=${w}&h=${h}&fit=crop&q=85`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch image ${src.id}: HTTP ${res.status}`);
      const raw = Buffer.from(await res.arrayBuffer());

      const fullRes = await sharp(raw)
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      const thumbRes = await sharp(raw)
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer({ resolveWithObject: true });

      fullBuf = fullRes.data;
      thumbBuf = thumbRes.data;

      meta = {
        index: i,
        id: src.id,
        title: src.title,
        orientation: src.orientation,
        width: fullRes.info.width,
        height: fullRes.info.height,
        fullBytes: fullBuf.length,
        thumbBytes: thumbBuf.length,
        checksum: crypto.createHash("sha256").update(fullBuf).digest("hex"),
      };

      writeFileSync(fullCachePath, fullBuf);
      writeFileSync(thumbCachePath, thumbBuf);
      writeFileSync(metaCachePath, JSON.stringify(meta, null, 2));

      writeFileSync(resolve(PUBLIC_IMG_DIR, `estate-${i}.webp`), fullBuf);
      console.log(`done (${meta.width}x${meta.height}, ${Math.round(meta.fullBytes / 1024)} KB)`);
    }

    masterImages.push({
      ...meta,
      fullBuf,
      thumbBuf,
    });
  }

  const landscapes = masterImages.filter((m) => m.orientation === "landscape");
  const portraits = masterImages.filter((m) => m.orientation === "portrait");
  console.log(`Master pool ready: ${landscapes.length} landscapes, ${portraits.length} portraits.`);
  return { landscapes, portraits, masterImages };
}

// 2. Generate 100 Realistic Estate Listings
function generateListings(count, { landscapes, portraits }) {
  console.log(`\n=== Generating ${count} Authentic Coorg Estate Definitions ===`);

  const titles = [
    // Madikeri Estates
    "15 Acre Arabica Coffee Estate with Mountain Spring in Madikeri",
    "28 Acre Legacy Heritage Coffee Plantation with Colonial Bungalow",
    "8 Acre Certified Organic Robusta & Pepper Estate near Madikeri",
    "12 Acre Valley-View Coffee Plantation facing Mandalpatti Range",
    "4.5 Acre Scenic Roadside Coffee Land ideal for Luxury Homestay",
    "22 Acre High-Elevation Arabica Estate with Silver Oak Trees",
    "18 Acre Prime Coffee & Cardamom Estate with Perennial Stream",
    "6 Acre Hilltop Plantation with Panoramic View of Western Ghats",
    "35 Acre Commercial Coffee & Timber Estate near Madikeri Town",
    "10 Acre Virgin Forest Border Coffee Estate with Waterfall Access",
    "7.5 Acre Lush Plantation with Running Natural Water Springs",
    "14 Acre Coffee Estate with 3-Phase Power & Concrete Drying Yard",
    "5 Acre Boutique Farm Land with Running Water & Mountain Views",
    "20 Acre Robusta Plantation with Modern Planter Villa in Madikeri",
    "9 Acre Organic Arabica Plantation with Intercropped Cardamom",

    // Suntikoppa & Boikere
    "16 Acre Premium Coffee Belt Plantation in Suntikoppa",
    "11 Acre High-Yielding Robusta & Pepper Estate near Suntikoppa",
    "24 Acre Model Coffee Estate with Automated Sprinkler Irrigation",
    "7 Acre River-Facing Coffee Land with Year-Round Water",
    "19 Acre Lush Estate with Heavy Pepper Yield and Silver Oaks",
    "8.5 Acre Scenic Hillside Coffee Estate in Boikere Valley",
    "13 Acre Mature Coffee & Orange Orchard Estate in Suntikoppa",
    "5.5 Acre Peaceful Farmland bordering Forest Reserve in Boikere",
    "26 Acre Robusta & Cardamom Plantation with Lake Frontage",
    "10.5 Acre Coffee Land with Direct Highway Access in Suntikoppa",

    // Somwarpet
    "30 Acre Commercial Arabica Plantation with Natural Lake in Somwarpet",
    "17 Acre High-Yield Pepper & Robusta Estate in Somwarpet Hills",
    "12 Acre Misty Valley Coffee Estate with Perennial Stream",
    "21 Acre Organic Coffee Plantation with Solar Fencing",
    "6.8 Acre Running Water Stream Border Coffee Estate",
    "40 Acre Grand Coffee Estate with Large Planter Residence",
    "15.5 Acre North Coorg Coffee Estate with River Cauvery Tributary",
    "9.2 Acre Agricultural Land with High-Yielding Areca & Coffee",
    "25 Acre Scenic Plantation with Hilltop Cottage in Somwarpet",
    "8 Acre Road-Front Coffee Estate suitable for Eco-Resort",

    // Virajpet & Gonikoppal
    "27 Acre Rich South Coorg Robusta Estate in Virajpet",
    "14.5 Acre Prime Coffee & Pepper Land near Gonikoppal Market",
    "32 Acre Commercial Robusta Plantation with Dedicated Transformer",
    "11.8 Acre High-Yielding Coffee Estate with Cauvery River Basin Soil",
    "19.5 Acre Plantation with Heritage Kodava Style Bungalow",
    "8 Acre Flat Agricultural Land with Borewell and Open Well",
    "23 Acre Well-Maintained Robusta Estate with Processing Units",
    "6.2 Acre Road-Facing Commercial Land with Coffee Bushes",
    "16.5 Acre Pepper-Rich Coffee Estate in Virajpet Taluk",
    "38 Acre Sprawling Timber & Coffee Plantation in Gonikoppal",

    // Kushalnagar & Napoklu
    "10 Acre Riverfront Agricultural Plot in Kushalnagar",
    "5 Acre Scenic Riverside Land near Cauvery Nisargadhama",
    "12.5 Acre Farmland with Fertile Red Soil and Canal Water",
    "7.2 Acre Commercial Plot suitable for Warehouse or Resort",
    "15 Acre Heritage Agricultural Estate in Napoklu Cauvery Basin",
    "20 Acre High-Yield Robusta Plantation with River Access in Napoklu",
    "8.8 Acre Peaceful Countryside Estate with Natural Stream in Napoklu",
    "13.5 Acre Farm Land with Running Water and Electricity in Kushalnagar",
    "6.5 Acre Virgin Agricultural Plot near Golden Temple Highway",
    "18.2 Acre Planter Estate with Flowing River Border in Napoklu",
  ];

  const descriptions = [
    "Spectacular high-elevation coffee estate situated in the heart of Coorg. The property features fully matured Arabica and Robusta coffee bushes under a dense canopy of silver oak and native jungle wood trees. Abundant water is provided by a perennial mountain stream and a natural spring reservoir. Includes private tar road access and 3-phase commercial electricity.",
    "A rare opportunity to own a legacy coffee plantation in Kodagu. The estate boasts outstanding yearly yields of premium grade Robusta coffee and export-quality black pepper. Equipped with a traditional planter bungalow, tiled veranda, staff quarters, and a 6000 sqft concrete drying yard with an eco-pulper unit.",
    "Picturesque estate parcel overlooking mist-clad Western Ghats mountain ridges. The fertile volcanic soil and optimal rainfall provide exceptional growing conditions for coffee, cardamom, and Coorg mandarin oranges. The property features a natural river frontage with crystal-clear water flowing year-round.",
    "Well-organized commercial coffee plantation situated close to town yet retaining utter tranquility. Clean clear titles with single ownership and up-to-date Karnataka revenue records. The estate includes solar-powered boundary fencing, internal jeep tracks connecting all blocks, and dedicated transformer power.",
    "Nestled amidst rolling hills and lush tropical greenery, this estate offers an ideal blend of agricultural productivity and scenic lifestyle. Rich intercrops of Malabar black pepper and cardamom vines complement the thriving coffee bushes. Suitable for both active plantation management and boutique homestay hospitality.",
    "Lush South Coorg coffee estate featuring exceptional soil depth, gentle slopes, and reliable water sources. The plantation benefits from an annual rainfall of over 100 inches and cool mountain breezes. Includes a running stream, motor pump infrastructure, and paved access right to the estate gate.",
  ];

  const types = ["coffee_estate", "coffee_estate", "coffee_estate", "farm_land", "agricultural_land", "homestay_resort", "house_villa", "commercial_land"];

  const listings = [];

  for (let i = 0; i < count; i++) {
    const loc = LOCATIONS[i % LOCATIONS.length];
    const seller = SELLER_PROFILES[i % SELLER_PROFILES.length];
    const pType = types[i % types.length];
    const isFeatured = i < 16;

    const baseTitle = titles[i % titles.length];
    const title = count > titles.length && i >= titles.length ? `${baseTitle} (Block ${Math.floor(i / titles.length) + 1})` : baseTitle;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${i + 1}`;

    const acre = Math.round((2.5 + (i * 0.45) % 35) * 10) / 10;
    const pricePerAcre = 2500000 + (i * 125000) % 2500000;
    const price = Math.round((acre * pricePerAcre) / 50000) * 50000;

    const desc = descriptions[i % descriptions.length];
    const descFull = `${desc} Located in the scenic ${loc.name} taluk of Kodagu district. Excellent connectivity to major state highways while offering complete privacy and pristine nature.`;

    const propId = crypto.randomUUID();

    // Select 4 to 6 photos: 1 cover landscape, 1 portrait, 1 landscape, and up to 3 extras
    const coverPhoto = landscapes[i % landscapes.length];
    const portraitPhoto = portraits[i % portraits.length];
    const landscape2 = landscapes[(i + 3) % landscapes.length];
    const extraPhoto1 = (i % 2 === 0 ? landscapes : portraits)[(i + 7) % (i % 2 === 0 ? landscapes.length : portraits.length)];
    const extraPhoto2 = landscapes[(i + 5) % landscapes.length];
    const extraPhoto3 = portraits[(i + 9) % portraits.length];

    // All 100 listings get 6 authentic estate photos
    const photoCount = 6;
    const baseMedia = [
      { ...coverPhoto, isCover: true, sortOrder: 0, alt: `${title} - Scenic plantation cover` },
      { ...portraitPhoto, isCover: false, sortOrder: 1, alt: `${title} - Estate walkway and trees` },
      { ...landscape2, isCover: false, sortOrder: 2, alt: `${title} - Plantation rows and landscape` },
      { ...extraPhoto1, isCover: false, sortOrder: 3, alt: `${title} - Natural stream and greenery` },
      { ...extraPhoto2, isCover: false, sortOrder: 4, alt: `${title} - High-altitude mist and mountain peaks` },
      { ...extraPhoto3, isCover: false, sortOrder: 5, alt: `${title} - Ripening coffee berries on branch` },
    ].slice(0, photoCount);

    const mediaList = baseMedia.map((m) => ({
      ...m,
      mediaId: crypto.randomUUID(),
    }));

    const docId = crypto.randomUUID();

    const features = [
      { key: "plantation_type", value: "Arabica & Robusta Coffee with Pepper" },
      { key: "stream_or_river", value: i % 2 === 0 ? "true" : "false" },
      { key: "borewell", value: "true" },
      { key: "drying_yard", value: i % 3 === 0 ? "true" : "false" },
      { key: "farmhouse", value: i % 4 === 0 ? "true" : "false" },
      { key: "fenced", value: "true" },
      { key: "view", value: i % 2 === 0 ? "Misty Mountain View" : "Valley Canopy View" },
      { key: "distance_to_town_km", value: `${(2.5 + (i * 0.3) % 8).toFixed(1)} km` },
    ];

    listings.push({
      id: propId,
      ownerId: seller.id,
      sellerType: seller.type,
      slug,
      title,
      description: descFull,
      propertyType: pType,
      listingType: "sale",
      price,
      negotiable: i % 3 === 0,
      areaValue: acre,
      areaUnit: "acre",
      locationId: loc.id,
      latitude: loc.lat + ((i % 10) - 5) * 0.005,
      longitude: loc.lng + ((i % 8) - 4) * 0.005,
      addressText: `Near ${loc.name}, Kodagu District, Karnataka`,
      roadAccess: true,
      waterAvailable: true,
      electricityAvailable: true,
      featured: isFeatured,
      media: mediaList,
      doc: {
        id: docId,
        type: "rtc",
        filename: "RTC-Karnataka-Land-Record.pdf",
      },
      features,
    });
  }

  return listings;
}

// 3. Upload Media & Documents to Tigris S3
async function uploadToTigris(listings) {
  console.log(`\n=== Uploading Media & Documents to Tigris S3 Storage ===`);
  const tasks = [];

  for (const listing of listings) {
    for (const m of listing.media) {
      const fullKey = `properties/${listing.id}/${m.mediaId}/full.webp`;
      const thumbKey = `properties/${listing.id}/${m.mediaId}/thumb.webp`;

      tasks.push({
        bucket: BUCKET_MEDIA,
        key: fullKey,
        body: m.fullBuf,
        contentType: "image/webp",
      });
      tasks.push({
        bucket: BUCKET_MEDIA,
        key: thumbKey,
        body: m.thumbBuf,
        contentType: "image/webp",
      });
    }

    const docKey = `documents/${listing.id}/${listing.doc.id}.pdf`;
    tasks.push({
      bucket: BUCKET_DOCS,
      key: docKey,
      body: DUMMY_PDF_BYTES,
      contentType: "application/pdf",
    });
  }

  console.log(`Total objects to upload: ${tasks.length} (across ${listings.length} listings).`);
  let completed = 0;
  const start = Date.now();

  await mapConcurrent(tasks, 25, async (task) => {
    await s3.send(
      new PutObjectCommand({
        Bucket: task.bucket,
        Key: task.key,
        Body: task.body,
        ContentType: task.contentType,
      })
    );
    completed++;
    if (completed % 100 === 0 || completed === tasks.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      process.stdout.write(`Uploaded ${completed}/${tasks.length} objects in ${elapsed}s\r`);
    }
  });

  const totalTime = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✓ Finished Tigris uploads in ${totalTime}s.`);
}

// 4. Ingest into Supabase Database (clearing old dummy data first)
async function ingestIntoDatabase(listings) {
  console.log(`\n=== Clearing Previous Dummy Data and Ingesting 100 Fresh Listings ===`);

  const cleanSql = `
set session_replication_role = replica;
delete from public.property_features where property_id in (select id from public.properties where slug ~ '-[0-9]+$');
delete from public.property_documents where property_id in (select id from public.properties where slug ~ '-[0-9]+$');
delete from public.property_media where property_id in (select id from public.properties where slug ~ '-[0-9]+$');
delete from public.properties where slug ~ '-[0-9]+$';
set session_replication_role = DEFAULT;
`;
  execSync(`npx --yes supabase db query --linked`, { input: cleanSql, stdio: ["pipe", "pipe", "pipe"] });
  console.log("✓ Previous dummy listings wiped cleanly.");

  const CHUNK_SIZE = 20;
  const chunks = [];
  for (let i = 0; i < listings.length; i += CHUNK_SIZE) {
    chunks.push(listings.slice(i, i + CHUNK_SIZE));
  }

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    console.log(`Processing batch ${c + 1}/${chunks.length} (${chunk.length} properties)...`);

    const propValues = [];
    const mediaValues = [];
    const docValues = [];
    const featValues = [];

    for (const l of chunk) {
      const titleEsc = l.title.replace(/'/g, "''");
      const descEsc = l.description.replace(/'/g, "''");
      const addrEsc = l.addressText.replace(/'/g, "''");

      propValues.push(
        `('${l.id}', '${l.ownerId}', '${l.slug}', '${titleEsc}', '${descEsc}', '${l.propertyType}', '${l.listingType}', ` +
        `'${l.sellerType}', ${l.price}, ${l.negotiable}, ${l.areaValue}, '${l.areaUnit}', '${l.locationId}', ` +
        `${l.latitude.toFixed(6)}, ${l.longitude.toFixed(6)}, '${addrEsc}', ${l.roadAccess}, ${l.waterAvailable}, ` +
        `${l.electricityAvailable}, 'verified', ${l.featured}, now(), now(), now() + interval '1 year', ` +
        `false, true, 1, now(), now())`
      );

      for (const m of l.media) {
        const fullKey = `properties/${l.id}/${m.mediaId}/full.webp`;
        const thumbKey = `properties/${l.id}/${m.mediaId}/thumb.webp`;
        const altEsc = m.alt.replace(/'/g, "''");

        mediaValues.push(
          `('${m.mediaId}', '${l.id}', 'image', '${BUCKET_MEDIA}', '${fullKey}', '${thumbKey}', ` +
          `'${m.checksum}', 'ready', ${m.width}, ${m.height}, ${m.fullBytes}, '${altEsc}', ` +
          `${m.sortOrder}, ${m.isCover}, '${l.ownerId}', now())`
        );
      }

      const docKey = `documents/${l.id}/${l.doc.id}.pdf`;
      docValues.push(
        `('${l.doc.id}', '${l.id}', '${l.doc.type}', '${BUCKET_DOCS}', '${docKey}', ` +
        `'${DUMMY_PDF_CHECKSUM}', 'ready', 'application/pdf', ${DUMMY_PDF_BYTES.length}, '${l.doc.filename}', ` +
        `'accepted', 'Verified with Revenue Department', '${l.ownerId}', now())`
      );

      for (const f of l.features) {
        const fKeyEsc = f.key.replace(/'/g, "''");
        const fValEsc = f.value.replace(/'/g, "''");
        featValues.push(`(gen_random_uuid(), '${l.id}', '${fKeyEsc}', '${fValEsc}')`);
      }
    }

    const sql = `
set session_replication_role = replica;

insert into public.properties (
  id, owner_id, slug, title, description, property_type, listing_type,
  seller_type, price, negotiable, area_value, area_unit, location_id,
  latitude, longitude, address_text, road_access, water_available,
  electricity_available, status, featured, published_at, first_published_at,
  expires_at, owner_suspended, location_active, version, created_at, updated_at
) values
${propValues.join(",\n")};

insert into public.property_media (
  id, property_id, media_type, storage_bucket, storage_path, thumbnail_path,
  content_checksum, upload_state, width, height, byte_size, alt_text,
  sort_order, is_cover, uploaded_by, created_at
) values
${mediaValues.join(",\n")};

insert into public.property_documents (
  id, property_id, document_type, storage_bucket, storage_path,
  content_checksum, upload_state, mime_type, byte_size, original_filename,
  verification_status, admin_comment, uploaded_by, created_at
) values
${docValues.join(",\n")};

insert into public.property_features (
  id, property_id, feature_key, feature_value
) values
${featValues.join(",\n")};

set session_replication_role = DEFAULT;
`;

    execSync(`npx --yes supabase db query --linked`, {
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(`  ✓ Batch ${c + 1} inserted successfully.`);
  }

  console.log(`✓ All listings and associated media inserted into database.`);
}

async function verifyData() {
  console.log(`\n=== Verifying Ingested Listings ===`);
  const anon = createClient(SUPABASE_URL, SUPABASE_PUB_KEY);

  const { count: verifiedCount } = await anon
    .from("properties")
    .select("*", { count: "exact", head: true });

  const { data: sampleList } = await anon
    .from("properties")
    .select(`
      id, slug, title, price, area_value, area_unit, property_type, is_listed,
      location:locations(name),
      media:property_media(id, is_cover)
    `)
    .limit(3);

  console.log(`Total public listings visible to anon client: ${verifiedCount}`);
  console.log("Sample listings:", JSON.stringify(sampleList, null, 2));
}

async function main() {
  const master = await prepareMasterImages();
  const listings = generateListings(100, master);
  await uploadToTigris(listings);
  await ingestIntoDatabase(listings);
  await verifyData();
  console.log("\n✅ ALL 100 PURE COORG ESTATE LISTINGS SUCCESSFULLY UPDATED IN DB AND TIGRIS!");
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
