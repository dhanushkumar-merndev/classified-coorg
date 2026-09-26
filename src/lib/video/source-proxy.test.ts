import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withSourceProxy } from "./source-proxy";
import { encodeVideoChunk } from "./transcode";

// A storage read that stalls mid-response must not hang the job: the proxy
// cuts it off and ffmpeg re-requests from the byte where it stopped.

let work: string;
let source: Buffer;
let upstream: Server;
let origin: string;
const requests: string[] = [];

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "proxy-test-"));
  const ffmpeg = (await import("ffmpeg-static")).default!;
  const file = join(work, "src.mp4");
  const made = spawnSync(ffmpeg, [
    "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-t", "4",
    // Index first, so ffmpeg reads straight through and cannot skip the stall.
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file,
  ]);
  expect(made.status).toBe(0);
  source = await readFile(file);

  // Range-capable origin whose first response sends a third of the file and
  // then goes silent without closing the connection.
  upstream = createServer((req, res) => {
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : source.length - 1;
    requests.push(`${start}-${end}`);
    res.writeHead(range ? 206 : 200, {
      "content-type": "video/mp4",
      "accept-ranges": "bytes",
      "content-length": String(end - start + 1),
      ...(range ? { "content-range": `bytes ${start}-${end}/${source.length}` } : {}),
    });
    if (requests.length === 1) {
      res.write(source.subarray(start, start + Math.floor(source.length / 3)));
      return; // stall
    }
    res.end(source.subarray(start, end + 1));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/object`;
});

afterAll(async () => {
  upstream?.closeAllConnections();
  upstream?.close();
  if (work) await rm(work, { recursive: true, force: true });
});

describe("source proxy", () => {
  test("a stalled read is cut off and resumed from the same byte", async () => {
    const out = join(work, "out");
    await (await import("node:fs/promises")).mkdir(out);
    const started = Date.now();
    const { codecs } = await withSourceProxy(origin, (url) => encodeVideoChunk(url, "mov", {
      kind: "video", start: 0, length: 4, width: 320, height: 180, maxrateKbps: 500, fps: null, hdr: false,
    }, out), { stallMs: 1000 });

    const elapsed = Date.now() - started;
    expect(codecs).toMatch(/^avc1\./);
    expect(requests.length).toBeGreaterThanOrEqual(2);
    // The stall was waited out (not skipped), and the retry resumed where the
    // stalled response stopped rather than from the start.
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(30_000);
    expect(Number(requests[1]!.split("-")[0])).toBeGreaterThan(source.length / 4);
    expect(await readFile(join(out, "index.m3u8"), "utf8")).toContain("#EXT-X-ENDLIST");
  }, 60_000);
});
