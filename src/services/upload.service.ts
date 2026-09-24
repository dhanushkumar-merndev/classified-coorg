import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/lib/auth/dal";
import { DOCUMENT_LIMITS, DOCUMENT_TYPES, IMAGE_LIMITS, UPLOAD_TIMING } from "@/lib/config/uploads";
import { tigrisEnv } from "@/lib/env";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { findUnsafePdfFeatures, sanitizeFilename, sniffFileType } from "@/lib/storage/file-validation";
import { processDocumentImage, processListingImage } from "@/lib/storage/image-processing";
import type { StorageProvider } from "@/lib/storage/storage-provider";
import { tigrisStorage } from "@/lib/storage/tigris";
import { createServiceClient } from "@/lib/supabase/server";

// Upload lifecycle (architecture §13):
//   1. initiate: server authorizes, reserves a slot and returns a presigned PUT
//      for a UUID quarantine key. The browser never gets credentials.
//   2. the browser uploads directly to Tigris.
//   3. finalize: server takes a lease, reads the actual bytes, validates and
//      re-encodes them to a NEW immutable key, then commits metadata. The
//      quarantine key is never the final key, so a replayed presigned PUT
//      cannot alter reviewed bytes (STOR-004).
// Database functions re-check owner, account, role, listing state and quota
// at each step (MEDIA-009); the service role is used only for these calls.

const initiateSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("property_image"),
    propertyId: z.uuid(),
    fileName: z.string().max(400),
    contentType: z.enum(IMAGE_LIMITS.acceptedMimeTypes),
    size: z.int().positive().max(IMAGE_LIMITS.maxBytes),
  }),
  z.strictObject({
    kind: z.literal("property_document"),
    propertyId: z.uuid(),
    documentType: z.enum(DOCUMENT_TYPES),
    fileName: z.string().max(400),
    contentType: z.enum(DOCUMENT_LIMITS.acceptedMimeTypes),
    size: z.int().positive().max(DOCUMENT_LIMITS.maxBytes),
  }),
]);

export type InitiateUploadInput = z.input<typeof initiateSchema>;

interface Deps {
  storage: StorageProvider;
  buckets: { media: string; documents: string };
}

function defaultDeps(): Deps {
  const env = tigrisEnv();
  return { storage: tigrisStorage, buckets: { media: env.TIGRIS_BUCKET_MEDIA, documents: env.TIGRIS_BUCKET_DOCUMENTS } };
}

export async function initiateUpload(actor: Actor, raw: unknown, deps: Deps = defaultDeps()) {
  const parsed = initiateSchema.safeParse(raw);
  if (!parsed.success) {
    const tooLarge = parsed.error.issues.some((i) => i.path[0] === "size" && i.code === "too_big");
    const badType = parsed.error.issues.some((i) => i.path[0] === "contentType");
    throw new AppError(tooLarge ? "FILE_TOO_LARGE" : badType ? "UNSUPPORTED_MEDIA_TYPE" : "VALIDATION_FAILED");
  }
  const input = parsed.data;
  const isImage = input.kind === "property_image";
  const bucket = isImage ? deps.buckets.media : deps.buckets.documents;

  const { data, error } = await createServiceClient().rpc("upload_session_create", {
    p_actor_id: actor.id,
    p_property_id: input.propertyId,
    p_kind: input.kind,
    p_document_type: input.kind === "property_document" ? input.documentType : null,
    p_declared_size: input.size,
    p_declared_mime: input.contentType,
    p_original_filename: sanitizeFilename(input.fileName),
    p_bucket: bucket,
    p_max_items: isImage ? IMAGE_LIMITS.maxPerListing : DOCUMENT_LIMITS.maxPerListing,
    p_ttl_seconds: UPLOAD_TIMING.sessionTtlSeconds,
  });
  if (error) throw fromDatabaseError(error);
  const session = data as { session_id: string; quarantine_key: string };

  const upload = await deps.storage.presignPut(bucket, session.quarantine_key, {
    contentType: input.contentType,
    contentLength: input.size,
    expiresInSeconds: UPLOAD_TIMING.uploadUrlTtlSeconds,
  });
  return { sessionId: session.session_id, upload };
}

interface ClaimedSession {
  state: "processing";
  lease_token: string;
  property_id: string;
  kind: "property_image" | "property_document";
  document_type: string | null;
  bucket: string;
  quarantine_key: string;
  declared_size: number;
  declared_mime: string;
}

type Claim = ClaimedSession | { state: "finalized"; result_id: string; kind: ClaimedSession["kind"] };

export async function finalizeUpload(actor: Actor, sessionId: string, deps: Deps = defaultDeps()) {
  if (!z.uuid().safeParse(sessionId).success) throw new AppError("UPLOAD_NOT_FOUND");
  const db = createServiceClient();

  const { data: claimData, error: claimError } = await db.rpc("upload_session_claim", {
    p_session_id: sessionId,
    p_actor_id: actor.id,
    p_lease_seconds: UPLOAD_TIMING.leaseSeconds,
  });
  if (claimError) throw fromDatabaseError(claimError);
  const claim = claimData as Claim;
  if (claim.state === "finalized") return { id: claim.result_id, kind: claim.kind, replayed: true };

  const lease = { p_session_id: sessionId, p_actor_id: actor.id, p_lease_token: claim.lease_token };
  const fail = async (code: string) => {
    await db.rpc("upload_session_fail", { ...lease, p_error_code: code });
    await deps.storage.delete(claim.bucket, claim.quarantine_key).catch(() => undefined);
  };

  // The browser may not have finished uploading: hand the session back.
  const head = await deps.storage.head(claim.bucket, claim.quarantine_key);
  if (!head) {
    await db.rpc("upload_session_release", lease);
    throw new AppError("UPLOAD_NOT_FOUND", { detail: "upload_not_received" });
  }
  if (head.contentLength !== claim.declared_size) {
    await fail("size_mismatch");
    throw new AppError("UPLOAD_REJECTED", { detail: "size_mismatch" });
  }

  const isImage = claim.kind === "property_image";
  const maxBytes = isImage ? IMAGE_LIMITS.maxBytes : DOCUMENT_LIMITS.maxBytes;

  let outputs: Array<{ key: string; body: Buffer; contentType: string }>;
  let finalize: (checksum: string) => Promise<{ id: string; replayed: boolean }>;
  const newId = randomUUID();

  try {
    const bytes = await deps.storage.getBytes(claim.bucket, claim.quarantine_key, maxBytes);
    const sniffed = sniffFileType(bytes);

    if (isImage) {
      if (!sniffed || !(IMAGE_LIMITS.acceptedMimeTypes as readonly string[]).includes(sniffed)) {
        throw new AppError("UNSUPPORTED_MEDIA_TYPE");
      }
      const image = await processListingImage(bytes);
      const base = `properties/${claim.property_id}/${newId}`;
      outputs = [
        { key: `${base}/full.webp`, body: image.full, contentType: "image/webp" },
        { key: `${base}/thumb.webp`, body: image.thumb, contentType: "image/webp" },
      ];
      finalize = async (checksum) =>
        rpcResult(await db.rpc("upload_session_finalize_media", {
          ...lease,
          p_media_id: newId,
          p_storage_bucket: claim.bucket,
          p_storage_path: outputs[0].key,
          p_thumbnail_path: outputs[1].key,
          p_checksum: checksum,
          p_width: image.width,
          p_height: image.height,
          p_byte_size: image.full.byteLength,
          p_max_items: IMAGE_LIMITS.maxPerListing,
        }));
    } else {
      let body: Buffer;
      let contentType: "application/pdf" | "image/webp";
      if (sniffed === "application/pdf") {
        const unsafe = findUnsafePdfFeatures(bytes);
        if (unsafe.length > 0) throw new AppError("UPLOAD_REJECTED", { detail: "pdf_active_or_encrypted_content" });
        body = bytes;
        contentType = "application/pdf";
      } else if (sniffed && sniffed.startsWith("image/")) {
        body = await processDocumentImage(bytes);
        contentType = "image/webp";
      } else {
        throw new AppError("UNSUPPORTED_MEDIA_TYPE");
      }
      const key = `documents/${claim.property_id}/${newId}.${contentType === "application/pdf" ? "pdf" : "webp"}`;
      outputs = [{ key, body, contentType }];
      finalize = async (checksum) =>
        rpcResult(await db.rpc("upload_session_finalize_document", {
          ...lease,
          p_document_id: newId,
          p_storage_bucket: claim.bucket,
          p_storage_path: key,
          p_checksum: checksum,
          p_mime_type: contentType,
          p_byte_size: body.byteLength,
          p_max_items: DOCUMENT_LIMITS.maxPerListing,
        }));
    }
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError("UPLOAD_REJECTED", { cause: error });
    if (appError.code === "DEPENDENCY_FAILED") {
      await db.rpc("upload_session_release", lease);
    } else {
      await fail(appError.detail ?? appError.code.toLowerCase());
    }
    throw appError;
  }

  // Write final objects, then commit metadata. If the commit fails or another
  // attempt already finalized, remove this attempt's objects.
  const checksum = createHash("sha256").update(outputs[0].body).digest("hex");
  const written: string[] = [];
  try {
    for (const out of outputs) {
      await deps.storage.put(claim.bucket, out.key, out.body, { contentType: out.contentType });
      written.push(out.key);
    }
    const result = await finalize(checksum);
    if (result.id !== newId) await removeObjects(deps, claim.bucket, written);
    await deps.storage.delete(claim.bucket, claim.quarantine_key).catch(() => undefined);
    return { id: result.id, kind: claim.kind, replayed: result.replayed };
  } catch (error) {
    await removeObjects(deps, claim.bucket, written);
    if (error instanceof AppError && error.code === "UPLOAD_LEASE_LOST") {
      // Another worker owns the session now; leave its quarantine object alone.
    } else if (error instanceof AppError && error.code !== "DEPENDENCY_FAILED" && error.code !== "INTERNAL") {
      // Listing no longer editable, limit reached, lease lost: final answer.
      await fail(error.code.toLowerCase());
    } else {
      await db.rpc("upload_session_release", lease);
    }
    throw error;
  }
}

function rpcResult(response: { data: unknown; error: { message?: string; details?: string | null; code?: string } | null }) {
  if (response.error) throw fromDatabaseError(response.error);
  return response.data as { id: string; replayed: boolean };
}

async function removeObjects(deps: Deps, bucket: string, keys: string[]) {
  for (const key of keys) {
    await deps.storage.delete(bucket, key).catch((error: unknown) => {
      // Left for the reconciliation job (GAP-11/27).
      logger.warn("upload.orphan_object", { bucket, key, error });
    });
  }
}
