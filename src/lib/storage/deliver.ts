import "server-only";
import { AppError } from "@/lib/errors";
import type { StorageProvider } from "./storage-provider";

// Streams a private object through the application with explicit headers.
// Buckets stay private; the route in front of this decides who may read.

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-site",
};

export async function streamObject(
  storage: StorageProvider,
  bucket: string,
  key: string,
  headers: Record<string, string>,
): Promise<Response> {
  const object = await storage.getStream(bucket, key);
  if (!object) throw new AppError("NOT_FOUND");
  return new Response(object.body, {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      "Content-Length": String(object.contentLength),
      ...headers,
    },
  });
}

export function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { ...BASE_HEADERS, "Cache-Control": "no-store", "Content-Type": "text/plain" },
  });
}
