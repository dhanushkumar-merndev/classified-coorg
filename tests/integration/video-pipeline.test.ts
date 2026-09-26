// Live check of the video pipeline against the staging media bucket: a
// generated clip is uploaded as the source, probed, planned, encoded chunk by
// chunk from its signed URL exactly as the jobs do, and the assembled HLS
// stream is then decoded by ffmpeg straight from Tigris. Runs only with
// Tigris credentials (`.env`); every object is under a run-scoped
// `test-runs/` prefix and deleted afterwards.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

if (existsSync(".env")) process.loadEnvFile(".env");
const configured = Boolean(process.env.TIGRIS_STORAGE_ACCESS_KEY_ID && process.env.TIGRIS_BUCKET_MEDIA);

describe.skipIf(!configured)("video pipeline (live Tigris)", () => {
  const prefix = `test-runs/${randomUUID()}`;
  const written: string[] = [];
  let work: string;
  let bucket: string;
  let storage: typeof import("@/lib/storage/tigris").tigrisStorage;
  let ffmpeg: string;

  beforeAll(async () => {
    storage = (await import("@/lib/storage/tigris")).tigrisStorage;
    ffmpeg = (await import("ffmpeg-static")).default!;
    bucket = process.env.TIGRIS_BUCKET_MEDIA!;
    work = await mkdtemp(join(tmpdir(), "video-it-"));
  });

  afterAll(async () => {
    for (const key of written) await storage.delete(bucket, key).catch(() => undefined);
    if (work) await rm(work, { recursive: true, force: true });
  });

  test("upload → probe → chunked encode → stitched HLS plays end to end", async () => {
    const { checkSource, encodeAudio, encodeVideoChunk, extractPoster, planJobs, probeSource } = await import("@/lib/video/transcode");
    const { buildMasterPlaylist, buildMediaPlaylist, groupTracks, readChunkPlaylist } = await import("@/lib/video/playlist");
    const { sniffVideoContainer } = await import("@/lib/storage/file-validation");
    const { withSourceProxy } = await import("@/lib/video/source-proxy");

    // A 30 s 1080p phone-like clip with sound, moov at the end like most phones.
    const source = join(work, "source.mp4");
    const gen = spawnSync(ffmpeg, [
      "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
      "-t", "30", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-metadata", "location=+12.4244+075.7382/",
      source,
    ]);
    expect(gen.status, gen.stderr.toString()).toBe(0);

    const sourceKey = `${prefix}/source`;
    written.push(sourceKey);
    await storage.putFile(bucket, sourceKey, source, { contentType: "video/mp4" });
    expect(sniffVideoContainer(await storage.getHead(bucket, sourceKey, 16))).toBe("mov");
    const signed = await storage.presignGet(bucket, sourceKey, { expiresInSeconds: 600 });
    // Every ffmpeg run reads the source through its own loopback proxy, as in the jobs.
    const viaProxy = <T,>(fn: (url: string) => Promise<T>) => withSourceProxy(signed, fn);

    const info = await viaProxy((url) => probeSource(url, "mov"));
    expect(info).toMatchObject({ width: 1920, height: 1080, hasAudio: true, hdr: false });
    expect(info.durationSeconds).toBeCloseTo(30, 0);
    checkSource(info);

    await viaProxy((url) => extractPoster(url, "mov", info, join(work, "poster.jpg")));
    expect((await stat(join(work, "poster.jpg"))).size).toBeGreaterThan(1000);

    const jobs = planJobs(info);
    expect(jobs.map((j) => `${j.rendition}/${j.chunk}`)).toEqual([
      "1080p/0", "1080p/1", "720p/0", "720p/1", "360p/0", "360p/1", "audio/0",
    ]);

    // Run every job as its own worker would. Three at a time, as the local
    // runner does, so the test is not starved of CPU next to other suites.
    const runJob = async (job: (typeof jobs)[number]) => {
      const dir = `${job.rendition}/c${job.chunk}`;
      const out = join(work, dir);
      await mkdir(out, { recursive: true });
      const params = job.params;
      const { codecs } = await viaProxy((url) => params.kind === "video"
        ? encodeVideoChunk(url, "mov", params, out)
        : encodeAudio(url, "mov", params, out));
      const playlist = readChunkPlaylist(await readFile(join(out, "index.m3u8"), "utf8"));
      for (const file of [playlist.init, ...playlist.segments.map((s) => s.file)]) {
        const key = `${prefix}/${dir}/${file}`;
        written.push(key);
        await storage.putFile(bucket, key, join(out, file), { contentType: file.endsWith(".mp4") ? "video/mp4" : "video/iso.segment" });
      }
      return {
        rendition: job.rendition, chunk: job.chunk, codecs,
        ...(job.params.kind === "video" ? { width: job.params.width, height: job.params.height } : {}),
        init: `${dir}/${playlist.init}`, init_sha: (await readFile(join(out, playlist.init))).toString("base64").slice(0, 16),
        segments: await Promise.all(playlist.segments.map(async (s) =>
          ({ f: `${dir}/${s.file}`, d: s.duration, b: (await stat(join(out, s.file))).size }))),
      };
    };
    const outputs: Awaited<ReturnType<typeof runJob>>[] = [];
    for (let i = 0; i < jobs.length; i += 3) outputs.push(...await Promise.all(jobs.slice(i, i + 3).map(runJob)));

    // Chunks of one quality share an identical init segment.
    const inits720 = await Promise.all([0, 1].map((c) => readFile(join(work, `720p/c${c}/init.mp4`))));
    expect(inits720[0]!.equals(inits720[1]!)).toBe(true);

    const master = buildMasterPlaylist(outputs);
    expect(master).toContain('CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"');

    // Serve the playlists from disk; segments come from Tigris via signed URLs.
    const { video, audio } = groupTracks(outputs);
    const sign = (p: string) => storage.presignGet(bucket, `${prefix}/${p}`, { expiresInSeconds: 600 });
    const hls = join(work, "hls");
    await mkdir(join(hls, "audio"), { recursive: true });
    await writeFile(join(hls, "master.m3u8"), master);
    for (const track of [...video, audio!]) {
      await mkdir(join(hls, track.rendition), { recursive: true });
      await writeFile(join(hls, track.rendition, "index.m3u8"), await buildMediaPlaylist(track, sign));
    }
    expect((await readdir(hls)).sort()).toEqual(["1080p", "360p", "720p", "audio", "master.m3u8"]);

    // Decode the stitched 720p stream across the chunk boundary at 24 s:
    // every frame present, timestamps continuous, sound for the whole length.
    // Needs an ffmpeg that can resolve DNS (the bundled static build cannot):
    // a system ffmpeg, or FFMPEG_PLAYBACK_PATH.
    const player = process.env.FFMPEG_PLAYBACK_PATH ?? "ffmpeg";
    if (spawnSync(player, ["-version"]).status !== 0) return;
    const play = spawnSync(player, [
      "-v", "info", "-protocol_whitelist", "file,https,tls,tcp,crypto", "-i", join(hls, "720p", "index.m3u8"),
      "-protocol_whitelist", "file,https,tls,tcp,crypto", "-i", join(hls, "audio", "index.m3u8"), "-map", "0:v", "-map", "1:a", "-vf", "showinfo", "-f", "null", "-",
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    expect(play.status, play.stderr.slice(-2000)).toBe(0);
    const frames = [...play.stderr.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(frames).toHaveLength(900);
    const steps = frames.slice(1).map((t, i) => t - frames[i]!);
    expect(Math.max(...steps)).toBeLessThan(0.034);
    expect(Math.min(...steps)).toBeGreaterThan(0.032);

    // No GPS or other source metadata survives into the published stream.
    const init = await readFile(join(work, "1080p/c0/init.mp4"));
    expect(init.includes(Buffer.from("+12.4244"))).toBe(false);
  }, 600_000);
});
