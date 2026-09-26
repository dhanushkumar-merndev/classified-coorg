import "server-only";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VIDEO_LIMITS, VIDEO_TIMING } from "@/lib/config/uploads";
import { AppError, fromDatabaseError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { VideoContainer } from "@/lib/storage/file-validation";
import type { StorageProvider } from "@/lib/storage/storage-provider";
import { tigrisStorage } from "@/lib/storage/tigris";
import { createServiceClient } from "@/lib/supabase/server";
import { contentTypeFor, readChunkPlaylist, safePath, type EncodeOutput } from "@/lib/video/playlist";
import { withSourceProxy } from "@/lib/video/source-proxy";
import {
  VideoJobError, checkSource, encodeAudio, encodeVideoChunk, extractPoster, planJobs, probeSource,
  type EncodeParams,
} from "@/lib/video/transcode";

// Listing video transcoding (migration 20260926000100_property_videos.sql).
//
// A job is claimed with a lease, worked, and recorded through service-role
// RPCs that re-check the lease, so a duplicate or late worker cannot record a
// result. `prepare` probes the upload and fans out one `encode` job per
// (quality, time chunk) plus audio; every job is small enough to finish well
// inside one function invocation, and all of them run in parallel.
//
// Where jobs run: on Vercel each job is its own invocation of
// /api/jobs/video (a fresh 300 s budget and CPU); on a long-running server
// (next dev / next start) they run in this process. Jobs that were never
// started, or whose worker died, are picked up again by the editor's status
// polling and by the daily maintenance job.

/** Output objects never change (paths are per video); browsers may cache
 *  them for as long as a signed URL to them stays valid. */
const OBJECT_CACHE_CONTROL = "private, max-age=31536000, immutable";
const UPLOAD_CONCURRENCY = 6;
const LOCAL_CONCURRENCY = 3;

interface VideoRef {
  id: string;
  property_id: string;
  bucket: string;
  source_key: string | null;
  container: VideoContainer;
  hls_prefix: string;
}

interface ClaimedJob {
  claimed: true;
  lease_token: string;
  kind: "prepare" | "encode";
  rendition: string | null;
  chunk: number | null;
  params: EncodeParams | Record<string, never>;
  attempt: number;
  video: VideoRef;
}

interface Cleanup {
  bucket: string | null;
  source_key: string | null;
}

type Claim = ClaimedJob | { claimed: false; reason: string; cleanup?: Cleanup | null };

interface Deps {
  storage: StorageProvider;
}

const defaultDeps = (): Deps => ({ storage: tigrisStorage });

function data<T>(response: { data: unknown; error: { message?: string; details?: string | null; code?: string } | null }): T {
  if (response.error) throw fromDatabaseError(response.error);
  return response.data as T;
}

/** Runs one job to completion. Never throws: failures are recorded on the job. */
export async function runVideoJob(jobId: string, deps: Deps = defaultDeps()): Promise<void> {
  const db = createServiceClient();
  let claim: Claim;
  try {
    claim = data<Claim>(await db.rpc("video_job_claim", {
      p_job_id: jobId, p_lease_seconds: VIDEO_TIMING.jobLeaseSeconds, p_max_attempts: VIDEO_TIMING.maxAttempts,
    }));
  } catch (error) {
    logger.error("video.job_claim_failed", { jobId, error });
    return;
  }
  if (!claim.claimed) {
    await removeSource(deps, claim.cleanup);
    return;
  }

  const started = Date.now();
  const work = await mkdtemp(join(tmpdir(), "video-"));
  const lease = { p_job_id: jobId, p_lease_token: claim.lease_token };
  try {
    if (!claim.video.source_key) throw new VideoJobError("source_missing", false);
    if (claim.kind === "prepare") await prepare(db, deps, claim, lease, work);
    else await encode(db, deps, claim, lease, work);
    logger.info("video.job_done", {
      jobId, kind: claim.kind, rendition: claim.rendition, chunk: claim.chunk, ms: Date.now() - started,
    });
  } catch (error) {
    const failure = error instanceof VideoJobError
      ? error
      : error instanceof AppError && error.code === "DEPENDENCY_FAILED"
        ? new VideoJobError("storage_unavailable", true, { cause: error })
        : new VideoJobError("internal_error", true, { cause: error });
    logger.warn("video.job_failed", {
      jobId, kind: claim.kind, rendition: claim.rendition, chunk: claim.chunk, code: failure.code,
      attempt: claim.attempt, ms: Date.now() - started, error: failure.cause ?? error,
    });
    try {
      const out = data<{ ok: boolean; retry: boolean; cleanup?: Cleanup }>(await db.rpc("video_job_fail", {
        ...lease, p_error_code: failure.code, p_retryable: failure.retryable, p_max_attempts: VIDEO_TIMING.maxAttempts,
      }));
      if (out.retry) await kickVideoJobs([jobId]);
      await removeSource(deps, out.cleanup);
    } catch (recordError) {
      // The lease expires and the job is picked up again.
      logger.error("video.job_fail_record_failed", { jobId, error: recordError });
    }
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

type Db = ReturnType<typeof createServiceClient>;
type Lease = { p_job_id: string; p_lease_token: string };

/** Runs `fn` with a URL ffmpeg can read the upload from. */
async function withSource<T>(deps: Deps, video: VideoRef, fn: (url: string) => Promise<T>): Promise<T> {
  const signed = await deps.storage.presignGet(video.bucket, video.source_key!, { expiresInSeconds: 3600 });
  return withSourceProxy(signed, fn);
}

async function prepare(db: Db, deps: Deps, claim: ClaimedJob, lease: Lease, work: string) {
  const { video } = claim;
  const posterFile = join(work, "poster.jpg");
  const posterKey = `${video.hls_prefix}/poster.jpg`;
  const info = await withSource(deps, video, async (url) => {
    const probed = await probeSource(url, video.container);
    checkSource(probed);
    await extractPoster(url, video.container, probed, posterFile);
    return probed;
  });
  await deps.storage.putFile(video.bucket, posterKey, posterFile, { contentType: "image/jpeg", cacheControl: OBJECT_CACHE_CONTROL });

  const cap = VIDEO_LIMITS.maxDurationSeconds + VIDEO_LIMITS.durationToleranceSeconds;
  const out = data<{ ok: boolean; job_ids?: string[]; cleanup?: Cleanup }>(await db.rpc("video_job_prepared", {
    ...lease,
    p_duration_seconds: Math.round(Math.min(info.durationSeconds, cap) * 100) / 100,
    p_width: info.width,
    p_height: info.height,
    p_poster_path: posterKey,
    p_jobs: planJobs(info),
  }));
  if (!out.ok) {
    await removeSource(deps, out.cleanup);
    return;
  }
  await kickVideoJobs(out.job_ids ?? []);
}

async function encode(db: Db, deps: Deps, claim: ClaimedJob, lease: Lease, work: string) {
  const { video } = claim;
  const params = claim.params as EncodeParams;
  const rendition = claim.rendition!;
  const chunk = claim.chunk!;
  const dir = `${rendition}/c${chunk}`;
  const outDir = join(work, "out");
  await mkdir(outDir);

  const { codecs } = await withSource(deps, video, (url) => params.kind === "video"
    ? encodeVideoChunk(url, video.container, params, outDir)
    : encodeAudio(url, video.container, params, outDir));

  let playlist;
  try {
    playlist = readChunkPlaylist(await readFile(join(outDir, "index.m3u8"), "utf8"));
  } catch (error) {
    throw new VideoJobError("video_encode_failed", false, { cause: error });
  }
  const files = [playlist.init, ...playlist.segments.map((s) => s.file)];
  const produced = new Set(await readdir(outDir));
  if (files.some((f) => !produced.has(f))) throw new VideoJobError("video_encode_failed", false);

  // Upload before recording: a recorded result always points at real objects.
  // Keys are deterministic, so a retried attempt overwrites the same objects.
  await forEachLimited(files, UPLOAD_CONCURRENCY, (file) =>
    deps.storage.putFile(video.bucket, `${video.hls_prefix}/${safePath(`${dir}/${file}`)}`, join(outDir, file), {
      contentType: contentTypeFor(file), cacheControl: OBJECT_CACHE_CONTROL,
    }));

  const segments = [];
  for (const s of playlist.segments) {
    segments.push({ f: `${dir}/${s.file}`, d: s.duration, b: (await stat(join(outDir, s.file))).size });
  }
  const result: EncodeOutput = {
    rendition,
    chunk,
    codecs,
    ...(params.kind === "video" ? { width: params.width, height: params.height } : {}),
    init: `${dir}/${playlist.init}`,
    init_sha: createHash("sha256").update(await readFile(join(outDir, playlist.init))).digest("hex").slice(0, 16),
    segments,
  };
  const out = data<{ ok: boolean; ready: boolean; cleanup?: Cleanup }>(
    await db.rpc("video_job_encode_done", { ...lease, p_result: result }));
  if (out.ready) logger.info("video.ready", { videoId: video.id });
  await removeSource(deps, out.cleanup);
}

async function forEachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function removeSource(deps: Deps, cleanup: Cleanup | null | undefined) {
  if (!cleanup?.bucket || !cleanup.source_key) return;
  await deps.storage.delete(cleanup.bucket, cleanup.source_key).catch((error: unknown) => {
    logger.warn("video.orphan_source", { key: cleanup.source_key, error });
  });
}

// --- dispatch -----------------------------------------------------------------

let localRunning = 0;
const localQueue: string[] = [];

function runLocal(jobId: string) {
  if (localRunning >= LOCAL_CONCURRENCY) {
    if (!localQueue.includes(jobId)) localQueue.push(jobId);
    return;
  }
  localRunning++;
  void runVideoJob(jobId).finally(() => {
    localRunning--;
    const next = localQueue.shift();
    if (next) runLocal(next);
  });
}

/** This deployment's own origin: the job must run on the same code version. */
function selfOrigin(): string {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Starts jobs. Duplicate starts are harmless: only one claim wins. */
export async function kickVideoJobs(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  if (!process.env.VERCEL) {
    for (const id of jobIds) runLocal(id);
    return;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("video.dispatch_unconfigured", { detail: "CRON_SECRET is not set; video jobs cannot start" });
    return;
  }
  const headers: Record<string, string> = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
  // Preview deployments sit behind Vercel deployment protection.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  await Promise.all(jobIds.map(async (jobId) => {
    try {
      const res = await fetch(`${selfOrigin()}/api/jobs/video`, {
        method: "POST", headers, body: JSON.stringify({ jobId }), signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) logger.error("video.dispatch_failed", { jobId, status: res.status });
    } catch (error) {
      logger.error("video.dispatch_failed", { jobId, error });
    }
  }));
}

/** Restarts jobs that should be running but are not (never started, or their
 *  worker died). One video, or all when `videoId` is null. */
export async function resumeStalledVideoJobs(videoId: string | null, limit = 50): Promise<number> {
  const ids = data<string[]>(await createServiceClient().rpc("video_jobs_stalled", {
    p_video_id: videoId, p_stale_seconds: VIDEO_TIMING.stalledAfterSeconds, p_limit: limit,
  }));
  await kickVideoJobs(ids);
  return ids.length;
}

/** Daily sweep: fails stuck videos, deletes released sources, resumes jobs. */
export async function runVideoMaintenance(deps: Deps = defaultDeps()) {
  const out = data<{ cleanup: Cleanup[] }>(await createServiceClient().rpc("video_maintenance", {
    p_stuck_after_seconds: VIDEO_TIMING.stuckAfterSeconds, p_batch: 200,
  }));
  for (const c of out.cleanup) await removeSource(deps, c);
  const resumed = await resumeStalledVideoJobs(null, 200);
  return { sources_deleted: out.cleanup.length, jobs_resumed: resumed };
}
