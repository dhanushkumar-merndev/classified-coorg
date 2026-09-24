// Live checks against the real staging Tigris buckets (STOR-001/002/003/005/012).
// Runs only when Tigris credentials are present (`.env` locally, CI secrets
// in a staging job); skipped otherwise. Every object it writes is under a
// run-scoped `test-runs/` prefix and deleted afterwards.
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

if (existsSync(".env")) process.loadEnvFile(".env");
const configured = Boolean(process.env.TIGRIS_STORAGE_ACCESS_KEY_ID && process.env.TIGRIS_BUCKET_MEDIA);

describe.skipIf(!configured)("Tigris staging buckets (live)", () => {
  const prefix = `test-runs/${randomUUID()}`;
  const written: Array<[string, string]> = [];
  let storage: typeof import("@/lib/storage/tigris").tigrisStorage;
  let media: string;
  let documents: string;

  beforeAll(async () => {
    storage = (await import("@/lib/storage/tigris")).tigrisStorage;
    media = process.env.TIGRIS_BUCKET_MEDIA!;
    documents = process.env.TIGRIS_BUCKET_DOCUMENTS!;
  });

  afterAll(async () => {
    for (const [bucket, key] of written) await storage.delete(bucket, key).catch(() => undefined);
  });

  test("server key can put, head, read and delete in each bucket", async () => {
    for (const bucket of [media, documents, process.env.TIGRIS_BUCKET_AVATARS!]) {
      const key = `${prefix}/roundtrip.txt`;
      written.push([bucket, key]);
      await storage.put(bucket, key, Buffer.from("hello coorg"), { contentType: "text/plain" });
      expect(await storage.head(bucket, key)).toMatchObject({ contentLength: 11 });
      expect((await storage.getBytes(bucket, key, 100)).toString()).toBe("hello coorg");
      await storage.delete(bucket, key);
      expect(await storage.head(bucket, key)).toBeNull();
    }
  });

  test("getBytes refuses objects above the byte ceiling", async () => {
    const key = `${prefix}/big.bin`;
    written.push([media, key]);
    await storage.put(media, key, Buffer.alloc(2048), { contentType: "application/octet-stream" });
    await expect(storage.getBytes(media, key, 1024)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  test("buckets are private: unsigned GET and PUT are denied (STOR-001)", async () => {
    const key = `${prefix}/private.txt`;
    written.push([documents, key]);
    await storage.put(documents, key, Buffer.from("secret deed"), { contentType: "text/plain" });
    const endpoint = new URL(process.env.TIGRIS_STORAGE_ENDPOINT!);
    const urls = [
      `${endpoint.protocol}//${documents}.${endpoint.host}/${key}`,
      `${endpoint.origin}/${documents}/${key}`,
    ];
    for (const url of urls) {
      const get = await fetch(url);
      expect(get.status, url).toBeGreaterThanOrEqual(400);
      expect(await get.text()).not.toContain("secret deed");
      const put = await fetch(url, { method: "PUT", body: "overwrite" });
      expect(put.status, url).toBeGreaterThanOrEqual(400);
    }
    expect((await storage.getBytes(documents, key, 100)).toString()).toBe("secret deed");
  });

  test("presigned PUT binds exact size and type (STOR-003)", async () => {
    const key = `quarantine/${prefix.replace("/", "-")}`;
    written.push([media, key]);
    const body = Buffer.from("0123456789");
    const grant = await storage.presignPut(media, key, {
      contentType: "image/jpeg", contentLength: body.length, expiresInSeconds: 60,
    });
    expect(grant.url).not.toContain(process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY!);

    const larger = await fetch(grant.url, {
      method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: Buffer.from("0123456789-extra"),
    });
    expect(larger.status).toBeGreaterThanOrEqual(400);
    const wrongType = await fetch(grant.url, { method: "PUT", headers: { "Content-Type": "text/html" }, body });
    expect(wrongType.status).toBeGreaterThanOrEqual(400);

    const ok = await fetch(grant.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body });
    expect(ok.status).toBe(200);
    expect(await storage.head(media, key)).toMatchObject({ contentLength: 10 });
  });

  test("the grant is scoped to one object key", async () => {
    const key = `quarantine/${prefix.replace("/", "-")}-scoped`;
    const grant = await storage.presignPut(media, key, { contentType: "image/jpeg", contentLength: 3, expiresInSeconds: 60 });
    const other = grant.url.replace(encodeURIComponent(key.split("/").pop()!), "someone-elses-object");
    expect(other).not.toBe(grant.url);
    const res = await fetch(other, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: "abc" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("image pipeline output stores and streams back as webp (STOR-005, MEDIA-007)", async () => {
    const { processListingImage } = await import("@/lib/storage/image-processing");
    const jpeg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#2f6b3a" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "gps-and-camera-data" } } })
      .toBuffer();
    const out = await processListingImage(jpeg);
    expect([out.width, out.height]).toEqual([1600, 1067]);
    expect(out.full.toString("latin1")).not.toContain("gps-and-camera-data");

    const key = `${prefix}/full.webp`;
    written.push([media, key]);
    await storage.put(media, key, out.full, { contentType: "image/webp" });
    const stream = await storage.getStream(media, key);
    expect(stream?.contentType).toBe("image/webp");
    const bytes = Buffer.from(await new Response(stream!.body).arrayBuffer());
    expect(bytes.equals(out.full)).toBe(true);
  });
});
