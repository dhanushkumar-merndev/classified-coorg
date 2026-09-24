import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { tigrisEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { StorageProvider } from "./storage-provider";

// Tigris through its S3-compatible API. Features used: presigned PUT with
// signed Content-Type/Content-Length, HEAD, GET, PUT, DELETE. Verify each
// against the live Tigris account before launch rather than assuming full AWS
// parity (STOR-003, STOR-012).

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    const env = tigrisEnv();
    client = new S3Client({
      endpoint: env.TIGRIS_STORAGE_ENDPOINT,
      region: env.TIGRIS_STORAGE_REGION,
      credentials: {
        accessKeyId: env.TIGRIS_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    error instanceof NotFound ||
    (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404
  );
}

export const tigrisStorage: StorageProvider = {
  async presignPut(bucket, key, { contentType, contentLength, expiresInSeconds }) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const url = await getSignedUrl(s3(), command, {
      expiresIn: expiresInSeconds,
      // Binding type and exact size into the signature means the grant cannot
      // be reused for a different or larger file.
      signableHeaders: new Set(["content-type", "content-length"]),
    });
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  },

  async head(bucket, key) {
    try {
      const out = await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { contentLength: out.ContentLength ?? 0, contentType: out.ContentType ?? null };
    } catch (error) {
      if (isMissing(error)) return null;
      throw new AppError("DEPENDENCY_FAILED", { cause: error });
    }
  },

  async getBytes(bucket, key, maxBytes) {
    let out;
    try {
      out = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (isMissing(error)) throw new AppError("UPLOAD_NOT_FOUND", { cause: error });
      throw new AppError("DEPENDENCY_FAILED", { cause: error });
    }
    if ((out.ContentLength ?? 0) > maxBytes) throw new AppError("FILE_TOO_LARGE");
    const chunks: Uint8Array[] = [];
    let total = 0;
    // Count while reading: never trust the declared length alone.
    for await (const chunk of out.Body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new AppError("FILE_TOO_LARGE");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },

  async getStream(bucket, key) {
    try {
      const out = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!out.Body) return null;
      return {
        body: out.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentLength: out.ContentLength ?? 0,
        contentType: out.ContentType ?? null,
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw new AppError("DEPENDENCY_FAILED", { cause: error });
    }
  },

  async put(bucket, key, body, { contentType }) {
    try {
      const out = await s3().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentMD5: createHash("md5").update(body).digest("base64"),
        }),
      );
      return { versionId: out.VersionId ?? null };
    } catch (error) {
      throw new AppError("DEPENDENCY_FAILED", { cause: error });
    }
  },

  async delete(bucket, key) {
    try {
      await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (!isMissing(error)) throw new AppError("DEPENDENCY_FAILED", { cause: error });
    }
  },
};
