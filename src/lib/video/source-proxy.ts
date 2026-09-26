import "server-only";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// The bundled static ffmpeg/ffprobe builds link glibc statically and cannot
// resolve host names (they crash on any https:// URL). They read the source
// through this loopback proxy instead: Node does DNS and TLS, ffmpeg talks
// plain HTTP to 127.0.0.1. Range requests pass through, so ffmpeg still seeks
// and fetches only the byte ranges it needs. One object per proxy, behind an
// unguessable path, for the duration of `fn`.
//
// Object storage reads occasionally stall mid-response. A response that
// sends nothing for `stallMs` is cut off; ffmpeg (started with -reconnect,
// see transcode.ts) then asks again from the byte where it stopped, instead
// of waiting until the job times out.

const FORWARDED = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];
const DEFAULT_STALL_MS = 15_000;

export async function withSourceProxy<T>(
  remoteUrl: string,
  fn: (localUrl: string) => Promise<T>,
  options: { stallMs?: number } = {},
): Promise<T> {
  const stallMs = options.stallMs ?? DEFAULT_STALL_MS;
  const path = `/${randomBytes(16).toString("hex")}`;
  const server = createServer(async (req, res) => {
    if (req.url !== path || req.method !== "GET") {
      res.writeHead(404).end();
      return;
    }
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        abort.abort();
        res.destroy();
      }, stallMs);
    };
    res.on("close", () => {
      clearTimeout(timer);
      abort.abort();
    });
    try {
      arm();
      const upstream = await fetch(remoteUrl, {
        headers: req.headers.range ? { range: req.headers.range } : {},
        signal: abort.signal,
      });
      const headers: Record<string, string> = {};
      for (const name of FORWARDED) {
        const value = upstream.headers.get(name);
        if (value) headers[name] = value;
      }
      res.writeHead(upstream.status, headers);
      if (!upstream.body) {
        clearTimeout(timer);
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      arm();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        arm();
        if (!res.write(value)) await once(res, "drain");
      }
      clearTimeout(timer);
      res.end();
    } catch {
      clearTimeout(timer);
      if (!res.headersSent) res.writeHead(502);
      res.destroy();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}${path}`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}
