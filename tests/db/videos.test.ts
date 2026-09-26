// Property video tours: upload finalize, leased transcode jobs, readiness,
// failure and removal (supabase/migrations/20260926000100_property_videos.sql).
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { TestDb, anon, service, user } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await TestDb.create();
});

type Json = Record<string, unknown>;

async function rpc<T = Json>(sql: string, params: unknown[]): Promise<T> {
  const [row] = await db.rows<{ r: T }>(service, `select ${sql} as r`, params);
  return row!.r;
}

/** Upload session → finalize, as the upload service does it. */
async function uploadVideo(ownerId: string, propertyId: string) {
  const created = await rpc<{ session_id: string }>(
    "public.upload_session_create($1, $2, 'property_video', null, 5000000, 'video/mp4', 'tour.mp4', 'media', 1, 600)",
    [ownerId, propertyId]);
  const claimed = await rpc<{ lease_token: string }>("public.upload_session_claim($1, $2, 120)", [created.session_id, ownerId]);
  const videoId = randomUUID();
  const finalized = await rpc<{ id: string; job_id: string; replayed: boolean }>(
    "public.upload_session_finalize_video($1, $2, $3, $4, 'mov', 5000000)",
    [created.session_id, ownerId, claimed.lease_token, videoId]);
  return { sessionId: created.session_id, lease: claimed.lease_token, videoId, ...finalized };
}

const claim = (jobId: string, maxAttempts = 3) =>
  rpc<{ claimed: boolean; lease_token: string; reason?: string; kind: string; rendition: string; chunk: number; video: Json }>(
    "public.video_job_claim($1, 300, $2)", [jobId, maxAttempts]);

// Two chunks of 720p plus the audio track.
const JOBS = [
  { rendition: "720p", chunk: 0, params: { start: 0, length: 24 } },
  { rendition: "720p", chunk: 1, params: { start: 24, length: 24 } },
  { rendition: "audio", chunk: 0, params: { start: 0, length: 48 } },
];

async function prepare(jobId: string) {
  const c = await claim(jobId);
  return rpc<{ ok: boolean; job_ids: string[] }>(
    "public.video_job_prepared($1, $2, 47.5, 1280, 720, $3, $4::jsonb)",
    [jobId, c.lease_token, `videos/x/poster.jpg`, JSON.stringify(JOBS)]);
}

function result(rendition: string, chunk: number) {
  return JSON.stringify({ rendition, chunk, codecs: "avc1.64001f", init: `${rendition}/c${chunk}/init.mp4`,
    segments: [{ f: `${rendition}/c${chunk}/seg_000.m4s`, d: 4, b: 1000 }] });
}

const done = (jobId: string, lease: string, rendition: string, chunk: number) =>
  rpc<Json>("public.video_job_encode_done($1, $2, $3::jsonb)", [jobId, lease, result(rendition, chunk)]);

describe("property videos", () => {
  test("finalize creates a processing video with a prepare job, and replays", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);
    expect(up.replayed).toBe(false);

    const [video] = await db.sql<Json>("select state, source_key, hls_prefix from public.property_videos where id = $1", [up.videoId]);
    expect(video).toMatchObject({ state: "processing", hls_prefix: `videos/${property}/${up.videoId}` });
    expect(String(video!.source_key)).toMatch(/^quarantine\//);

    const replay = await rpc<{ id: string; job_id: string; replayed: boolean }>(
      "public.upload_session_finalize_video($1, $2, $3, $4, 'mov', 5000000)",
      [up.sessionId, owner, up.lease, randomUUID()]);
    expect(replay).toEqual({ id: up.videoId, job_id: up.job_id, replayed: true });
  });

  test("one video per listing", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    await uploadVideo(owner, property);
    await expect(uploadVideo(owner, property)).rejects.toThrow("UPLOAD_LIMIT_REACHED");
  });

  test("prepare queues encode jobs; the last one makes the video ready", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);

    const prepared = await prepare(up.job_id);
    expect(prepared.ok).toBe(true);
    expect(prepared.job_ids).toHaveLength(3);
    expect((await claim(up.job_id)).reason).toBe("done");

    const claims = [];
    for (const id of prepared.job_ids) claims.push({ id, ...(await claim(id)) });
    expect(claims[0]).toMatchObject({ claimed: true, kind: "encode" });
    expect((await claim(claims[0]!.id)).reason).toBe("running"); // lease held

    // A result for the wrong chunk is refused.
    expect(await db.error(service, "select public.video_job_encode_done($1, $2, $3::jsonb)",
      [claims[0]!.id, claims[0]!.lease_token, result(claims[0]!.rendition, 7)])).toBe("VALIDATION_FAILED");

    for (const c of claims.slice(0, -1)) {
      expect(await done(c.id, c.lease_token, c.rendition, c.chunk)).toMatchObject({ ok: true, ready: false });
    }
    const c = claims.at(-1)!;
    const last = await done(c.id, c.lease_token, c.rendition, c.chunk);
    expect(last).toMatchObject({ ok: true, ready: true, cleanup: { bucket: "media" } });
    expect(String((last.cleanup as Json).source_key)).toMatch(/^quarantine\//);

    const [video] = await db.sql<{ state: string; source_key: string | null; outputs: Array<{ rendition: string; chunk: number }> }>(
      "select state, source_key, outputs from public.property_videos where id = $1", [up.videoId]);
    expect(video!.state).toBe("ready");
    expect(video!.source_key).toBeNull();
    expect(video!.outputs.map((o) => `${o.rendition}/${o.chunk}`)).toEqual(["720p/0", "720p/1", "audio/0"]);
  });

  test("a stale lease holder cannot complete", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);
    const { job_ids } = await prepare(up.job_id);
    const c = await claim(job_ids[0]!);
    const message = await db.error(service, "select public.video_job_encode_done($1, $2, $3::jsonb)",
      [job_ids[0], randomUUID(), result(c.rendition, c.chunk)]);
    expect(message).toBe("UPLOAD_LEASE_LOST");
  });

  test("retryable failures requeue until the attempt limit, then the video fails", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);

    const c1 = await claim(up.job_id, 2);
    expect(await rpc<Json>("public.video_job_fail($1, $2, 'network', true, 2)", [up.job_id, c1.lease_token]))
      .toMatchObject({ retry: true });
    const c2 = await claim(up.job_id, 2);
    const final = await rpc<Json>("public.video_job_fail($1, $2, 'network', true, 2)", [up.job_id, c2.lease_token]);
    expect(final).toMatchObject({ retry: false, cleanup: { bucket: "media" } });

    const [video] = await db.sql<Json>("select state, error_code, source_key from public.property_videos where id = $1", [up.videoId]);
    expect(video).toEqual({ state: "failed", error_code: "network", source_key: null });

    // A failed video makes way for a new upload.
    const again = await uploadVideo(owner, property);
    expect(again.replayed).toBe(false);
    expect(await db.sql("select count(*)::int as n from public.property_videos where property_id = $1 and removed_at is null", [property]))
      .toEqual([{ n: 1 }]);
  });

  test("a job whose leases keep expiring is exhausted and fails the video", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);
    await claim(up.job_id, 1);
    await db.sql("update app.video_jobs set lease_until = now() - interval '1 second' where id = $1", [up.job_id]);

    expect(JSON.parse(await db.sql<{ r: string }>("select public.video_jobs_stalled($1, 30, 10)::text as r", [up.videoId])
      .then((r) => r[0]!.r))).toEqual([up.job_id]);
    const exhausted = await claim(up.job_id, 1);
    expect(exhausted).toMatchObject({ claimed: false, reason: "exhausted" });
    expect(await db.sql("select state from public.property_videos where id = $1", [up.videoId])).toEqual([{ state: "failed" }]);
  });

  test("owners see their processing video; the public sees nothing until published", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const stranger = await db.createUser();
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);
    const q = "select id from public.property_videos where id = $1";
    expect(await db.rows(user(owner), q, [up.videoId])).toHaveLength(1);
    expect(await db.rows(user(stranger), q, [up.videoId])).toHaveLength(0);
    expect(await db.rows(anon, q, [up.videoId])).toHaveLength(0);
    expect(await db.error(anon, "update public.property_videos set state = 'ready'")).toMatch(/permission denied/);
  });

  test("submission waits for a processing video", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    await uploadVideo(owner, property);
    const [{ g }] = await db.sql<{ g: string[] }>(
      "select app.property_submission_gaps(p) as g from public.properties p where p.id = $1", [property]);
    expect(g).toEqual(["video_processing"]);
  });

  test("owner removal stops queued jobs; the source is released once", async () => {
    const owner = await db.createUser({ roles: ["seller"] });
    const other = await db.createUser({ roles: ["seller"] });
    const property = await db.createCompleteDraft(owner);
    const up = await uploadVideo(owner, property);

    expect(await db.error(user(other), "select public.remove_property_video($1)", [up.videoId])).toBe("PROPERTY_NOT_FOUND");
    await db.rows(user(owner), "select public.remove_property_video($1)", [up.videoId]);
    expect((await claim(up.job_id)).reason).toBe("failed");

    const first = await rpc<{ cleanup: Array<{ source_key: string }> }>("public.video_maintenance(86400, 100)", []);
    expect(first.cleanup.map((c) => c.source_key)).toContain(`quarantine/${up.sessionId}`);
    const second = await rpc<{ cleanup: Array<{ source_key: string }> }>("public.video_maintenance(86400, 100)", []);
    expect(second.cleanup.map((c) => c.source_key)).not.toContain(`quarantine/${up.sessionId}`);
  });
});
