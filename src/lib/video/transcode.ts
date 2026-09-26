import "server-only";
import { spawn } from "node:child_process";
import { access, chmod, constants, copyFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VIDEO_AUDIO_KBPS, VIDEO_LADDER, VIDEO_LIMITS, VIDEO_TIMING } from "@/lib/config/uploads";
import type { VideoContainer } from "@/lib/storage/file-validation";
import { readCodecs } from "./playlist";

// ffmpeg/ffprobe wrappers for listing videos. The source is streamed from
// the private bucket (range requests through source-proxy.ts), so the upload
// never has to fit in memory or /tmp. Every input is opened with a forced
// demuxer and a loopback-HTTP-only protocol whitelist: the file decides
// nothing about what else ffmpeg may open.

/** A job failure with a stable code; `retryable` failures are attempted again. */
export class VideoJobError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "VideoJobError";
  }
}

// --- binaries -----------------------------------------------------------------

const located = new Map<string, Promise<string>>();

/** FFMPEG_PATH / FFPROBE_PATH override the bundled static builds. */
function binary(name: "ffmpeg" | "ffprobe"): Promise<string> {
  let found = located.get(name);
  if (!found) {
    found = locate(name);
    found.catch(() => located.delete(name));
    located.set(name, found);
  }
  return found;
}

async function locate(name: "ffmpeg" | "ffprobe"): Promise<string> {
  let path = name === "ffmpeg" ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH;
  try {
    path ||= name === "ffmpeg"
      ? ((await import("ffmpeg-static")).default ?? undefined)
      : (await import("@ffprobe-installer/ffprobe")).default.path;
  } catch (error) {
    throw new VideoJobError("transcoder_unavailable", false, { cause: error });
  }
  if (!path) throw new VideoJobError("transcoder_unavailable", false);
  try {
    await access(path, constants.X_OK);
    return path;
  } catch {
    // Deployment bundles can drop the executable bit: run a copy from /tmp.
    const copy = join(tmpdir(), `coorg-${name}`);
    try {
      await access(copy, constants.X_OK);
    } catch {
      await copyFile(path, copy);
      await chmod(copy, 0o755);
    }
    return copy;
  }
}

function run(
  bin: string,
  args: string[],
  options: { timeoutSeconds: number; timeoutCode: string; timeoutRetryable?: boolean; failureCode: string; failureRetryable: boolean },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      if (stdout.length < 2_000_000) stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      stderr = (stderr + d).slice(-4000);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutSeconds * 1000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new VideoJobError("transcoder_unavailable", false, { cause: error }));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new VideoJobError(options.timeoutCode, options.timeoutRetryable ?? false));
      else if (code === 0) resolve(stdout);
      else {
        const tail = stderr.trim().split("\n").slice(-4).join(" | ");
        reject(new VideoJobError(options.failureCode, options.failureRetryable, { cause: new Error(tail) }));
      }
    });
  });
}

/** `url` is a withSourceProxy URL. `start` seeks with the container index
 *  before decoding (only the needed byte ranges are fetched), then decodes
 *  accurately to that instant. */
function inputArgs(url: string, container: VideoContainer, start = 0): string[] {
  if (!url.startsWith("http://127.0.0.1:")) throw new VideoJobError("source_not_proxied", false);
  return [
    "-protocol_whitelist", "http,tcp",
    // A read the proxy cut off as stalled is re-requested from the same byte.
    "-reconnect", "1", "-reconnect_on_network_error", "1", "-reconnect_delay_max", "4",
    ...(start > 0 ? ["-ss", String(start)] : []),
    "-f", container, "-i", url,
  ];
}

// --- probe --------------------------------------------------------------------

export interface SourceInfo {
  durationSeconds: number;
  /** Display size: rotation metadata applied (portrait phone video is tall). */
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  /** PQ or HLG transfer: tone-mapped to SDR, or colours come out washed out. */
  hdr: boolean;
}

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  color_transfer?: string;
  disposition?: { attached_pic?: number };
  side_data_list?: Array<{ rotation?: number | string }>;
  tags?: { rotate?: string };
}

export async function probeSource(url: string, container: VideoContainer): Promise<SourceInfo> {
  const stdout = await run(await binary("ffprobe"), [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", ...inputArgs(url, container),
  ], {
    timeoutSeconds: VIDEO_TIMING.probeTimeoutSeconds,
    timeoutCode: "video_probe_timeout",
    failureCode: "video_unreadable",
    // Usually a broken file; one retry covers a network blip.
    failureRetryable: true,
  });
  try {
    return readSourceInfo(JSON.parse(stdout));
  } catch (error) {
    if (error instanceof VideoJobError) throw error;
    throw new VideoJobError("video_unreadable", false, { cause: error });
  }
}

export function readSourceInfo(probe: { streams?: ProbeStream[]; format?: { duration?: string } }): SourceInfo {
  const streams = probe.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video?.width || !video.height) throw new VideoJobError("video_no_picture", false);
  const rotation = Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0);
  const quarterTurn = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  return {
    durationSeconds: Number(probe.format?.duration ?? video.duration),
    width: quarterTurn ? video.height : video.width,
    height: quarterTurn ? video.width : video.height,
    fps: frameRate(video.avg_frame_rate) || frameRate(video.r_frame_rate) || 30,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hdr: video.color_transfer === "smpte2084" || video.color_transfer === "arib-std-b67",
  };
}

function frameRate(value: string | undefined): number {
  const [num, den] = (value ?? "").split("/").map(Number);
  return num && den ? num / den : 0;
}

/** Throws a non-retryable VideoJobError when the source breaks a limit. */
export function checkSource(info: SourceInfo): void {
  const short = Math.min(info.width, info.height);
  const long = Math.max(info.width, info.height);
  if (!Number.isFinite(info.durationSeconds) || info.durationSeconds < 1) {
    throw new VideoJobError("video_too_short", false);
  }
  if (info.durationSeconds > VIDEO_LIMITS.maxDurationSeconds + VIDEO_LIMITS.durationToleranceSeconds) {
    throw new VideoJobError("video_too_long", false);
  }
  if (short > VIDEO_LIMITS.maxShortSide || long > VIDEO_LIMITS.maxLongSide) {
    throw new VideoJobError("video_resolution_too_high", false);
  }
  if (short < VIDEO_LIMITS.minShortSide) throw new VideoJobError("video_resolution_too_low", false);
}

// --- plan ---------------------------------------------------------------------

export type EncodeParams =
  | {
      kind: "video";
      start: number;
      length: number;
      width: number;
      height: number;
      maxrateKbps: number;
      /** Output frame rate when the source is faster than VIDEO_LIMITS.maxFps. */
      fps: number | null;
      hdr: boolean;
    }
  | { kind: "audio"; start: 0; length: number; audioKbps: number };

export interface PlannedJob {
  rendition: string;
  chunk: number;
  params: EncodeParams;
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/** Ladder rungs at or below the source's short side; never upscaled. */
export function planLadder(info: SourceInfo): Array<{ name: string; width: number; height: number; maxrateKbps: number }> {
  const short = Math.min(info.width, info.height);
  let rungs: Array<{ name: string; shortSide: number; maxrateKbps: number }> = VIDEO_LADDER.filter((r) => r.shortSide <= short);
  if (rungs.length === 0) {
    const lowest = VIDEO_LADDER[VIDEO_LADDER.length - 1]!;
    rungs = [{ ...lowest, name: `${even(short)}p`, shortSide: even(short) }];
  }
  const landscape = info.width >= info.height;
  return rungs.map((r) => {
    const scale = r.shortSide / short;
    return {
      name: r.name,
      width: landscape ? even(info.width * scale) : r.shortSide,
      height: landscape ? r.shortSide : even(info.height * scale),
      maxrateKbps: r.maxrateKbps,
    };
  });
}

/**
 * One job per (quality, time chunk) plus one for the audio track. Chunks are
 * a whole number of segments, so segment boundaries line up across qualities
 * and chunks. The last chunk runs to the duration cap, so a container that
 * under-reports its length is still cut at the limit rather than at a chunk.
 */
export function planJobs(info: SourceInfo): PlannedJob[] {
  const cap = VIDEO_LIMITS.maxDurationSeconds + VIDEO_LIMITS.durationToleranceSeconds;
  const duration = Math.min(info.durationSeconds, cap);
  const heavy = info.width * info.height * Math.min(info.fps, 60) > 1920 * 1080 * 31;
  const baseChunkSeconds = heavy ? VIDEO_TIMING.heavyChunkSeconds : VIDEO_TIMING.chunkSeconds;
  const fps = info.fps > VIDEO_LIMITS.maxFps + 0.5 ? VIDEO_LIMITS.maxFps : null;

  const jobs: PlannedJob[] = [];
  for (const rung of planLadder(info)) {
    const chunkSeconds = Math.min(rung.width, rung.height) >= 2160 ? VIDEO_TIMING.uhdChunkSeconds : baseChunkSeconds;
    const count = Math.max(1, Math.ceil((duration - 0.5) / chunkSeconds));
    for (let chunk = 0; chunk < count; chunk++) {
      const start = chunk * chunkSeconds;
      jobs.push({
        rendition: rung.name,
        chunk,
        params: {
          kind: "video",
          start,
          length: chunk === count - 1 ? cap - start : chunkSeconds,
          width: rung.width,
          height: rung.height,
          maxrateKbps: rung.maxrateKbps,
          fps,
          hdr: info.hdr,
        },
      });
    }
  }
  if (info.hasAudio) {
    jobs.push({ rendition: "audio", chunk: 0, params: { kind: "audio", start: 0, length: cap, audioKbps: VIDEO_AUDIO_KBPS } });
  }
  return jobs;
}

/** Frame rate cap first (less to scale), then scale or HDR→SDR tone mapping. */
export function videoFilter(p: { width: number; height: number; fps: number | null; hdr: boolean }, pixelFormat = "yuv420p"): string {
  const f: string[] = [];
  if (p.fps) f.push(`fps=${p.fps}`);
  if (p.hdr) {
    f.push(
      `zscale=w=${p.width}:h=${p.height}:t=linear:npl=100`,
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
    );
  } else {
    f.push(`scale=${p.width}:${p.height}:flags=bicubic`);
  }
  f.push(`format=${pixelFormat}`, "setsar=1");
  return f.join(",");
}

// --- outputs ------------------------------------------------------------------

/** One JPEG frame from early in the video, at most 1280 on the long side. */
export async function extractPoster(url: string, container: VideoContainer, info: SourceInfo, outFile: string): Promise<void> {
  const scale = Math.min(1, 1280 / Math.max(info.width, info.height));
  await run(await binary("ffmpeg"), [
    "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
    ...inputArgs(url, container, Math.min(1, info.durationSeconds / 2)),
    "-frames:v", "1",
    "-vf", videoFilter({ width: even(info.width * scale), height: even(info.height * scale), fps: null, hdr: info.hdr }, "yuvj420p"),
    "-q:v", "3", "-map_metadata", "-1",
    outFile,
  ], { timeoutSeconds: VIDEO_TIMING.probeTimeoutSeconds, timeoutCode: "video_poster_timeout", failureCode: "video_poster_failed", failureRetryable: true });
}

/** fMP4 HLS output into `outDir`: index.m3u8, init.mp4, seg_NNN.m4s. The
 *  single-variant master.m3u8 is only read for its CODECS. */
function hlsOutput(outDir: string): string[] {
  return [
    "-fflags", "+bitexact",
    "-f", "hls", "-hls_time", String(VIDEO_TIMING.segmentSeconds), "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4", "-hls_flags", "independent_segments",
    // Fragment times carry the chunk's real start (not an edit list), so
    // chunks encoded separately play back as one continuous stream.
    "-hls_segment_options", "movflags=+frag_discont",
    "-hls_fmp4_init_filename", "init.mp4",
    "-hls_segment_filename", join(outDir, "seg_%03d.m4s"),
    "-master_pl_name", "master.m3u8",
    join(outDir, "index.m3u8"),
  ];
}

const ENCODE_RUN = {
  timeoutSeconds: VIDEO_TIMING.encodeTimeoutSeconds,
  // A chunk is small, so a timeout is most often a storage read that stalled
  // for good: worth one more attempt. A source genuinely too heavy for the
  // limit fails again and the video fails with this code.
  timeoutCode: "video_encode_timeout",
  timeoutRetryable: true,
  failureCode: "video_encode_failed",
  failureRetryable: true,
} as const;

/**
 * One time chunk of one quality. Keyframes every 2 s from the chunk start, no
 * scene-cut keyframes and no B-frames, so segments cut at the same instants in
 * every quality and chunk, and each chunk's timestamps continue exactly where
 * the previous one ended. Metadata (including phone GPS location) is dropped.
 */
export async function encodeVideoChunk(
  url: string,
  container: VideoContainer,
  p: Extract<EncodeParams, { kind: "video" }>,
  outDir: string,
): Promise<{ codecs: string }> {
  await run(await binary("ffmpeg"), [
    "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
    ...inputArgs(url, container, p.start),
    "-t", String(p.length), "-output_ts_offset", String(p.start),
    "-map", "0:v:0", "-an", "-map_metadata", "-1", "-map_chapters", "-1",
    "-vf", videoFilter(p),
    "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-bf", "0", "-crf", "21",
    "-maxrate", `${p.maxrateKbps}k`, "-bufsize", `${p.maxrateKbps * 2}k`,
    "-force_key_frames", "expr:gte(t,n_forced*2)", "-sc_threshold", "0",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-flags:v", "+bitexact",
    ...hlsOutput(outDir),
  ], ENCODE_RUN);
  return { codecs: await codecsIn(outDir) };
}

/** The whole audio track as one stereo AAC rendition. */
export async function encodeAudio(
  url: string,
  container: VideoContainer,
  p: Extract<EncodeParams, { kind: "audio" }>,
  outDir: string,
): Promise<{ codecs: string }> {
  await run(await binary("ffmpeg"), [
    "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
    ...inputArgs(url, container),
    "-t", String(p.length),
    "-map", "0:a:0", "-vn", "-map_metadata", "-1", "-map_chapters", "-1",
    "-c:a", "aac", "-ac", "2", "-ar", "48000", "-b:a", `${p.audioKbps}k`,
    ...hlsOutput(outDir),
  ], ENCODE_RUN);
  return { codecs: await codecsIn(outDir) };
}

async function codecsIn(outDir: string): Promise<string> {
  try {
    return readCodecs(await readFile(join(outDir, "master.m3u8"), "utf8"));
  } catch (error) {
    throw new VideoJobError("video_encode_failed", false, { cause: error });
  }
}
