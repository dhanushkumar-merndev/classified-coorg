// StorageProvider abstraction (architecture §44). All buckets are private;
// callers never receive provider credentials, only short-lived single-object
// grants or bytes proxied through an authorized route.

export interface PresignedUpload {
  url: string;
  method: "PUT";
  /** Headers the browser must send exactly; they are part of the signature. */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObjectInfo {
  contentLength: number;
  contentType: string | null;
}

export interface StoredObjectStream extends StoredObjectInfo {
  body: ReadableStream<Uint8Array>;
}

export interface StorageProvider {
  presignPut(
    bucket: string,
    key: string,
    options: { contentType: string; contentLength: number; expiresInSeconds: number },
  ): Promise<PresignedUpload>;
  head(bucket: string, key: string): Promise<StoredObjectInfo | null>;
  /** Reads the whole object, refusing anything larger than maxBytes. */
  getBytes(bucket: string, key: string, maxBytes: number): Promise<Buffer>;
  getStream(bucket: string, key: string): Promise<StoredObjectStream | null>;
  /** First bytes of an object, for content sniffing without a full read. */
  getHead(bucket: string, key: string, bytes: number): Promise<Buffer>;
  /** Short-lived read grant for one object (video source, HLS segments). */
  presignGet(bucket: string, key: string, options: { expiresInSeconds: number }): Promise<string>;
  put(bucket: string, key: string, body: Buffer, options: { contentType: string; cacheControl?: string }): Promise<{ versionId: string | null }>;
  /** Streams a local file up without holding it in memory. */
  putFile(bucket: string, key: string, filePath: string, options: { contentType: string; cacheControl?: string }): Promise<void>;
  delete(bucket: string, key: string): Promise<void>;
}
