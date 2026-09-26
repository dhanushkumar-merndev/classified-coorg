-- Property video tours (product decision 2026-09-26): one video per listing,
-- up to 2 minutes, streamed as adaptive HLS (1080p / 720p / 360p) from the
-- private media bucket.
--
-- Pipeline (src/services/video.service.ts):
--   1. The browser uploads to a quarantine key through the usual upload
--      session. Finalize sniffs the container and creates the video in
--      `processing` with one `prepare` job. The quarantine object is kept as
--      the transcode source; it is never served.
--   2. `prepare` probes the source (ffprobe), writes the poster and enqueues
--      one `encode` job per (quality, time chunk) plus one for the audio
--      track. Each job is a separate function invocation with a small, fixed
--      amount of work, so no job nears the platform time limit and all run
--      in parallel.
--   3. When the last encode job finishes the video becomes `ready`: its
--      `outputs` hold every chunk's segment list, from which the playlists
--      are built on request. The source is released for deletion. Any final
--      failure marks the video `failed`.
-- Jobs are leased like upload sessions: a worker that dies (e.g. killed at
-- the function time limit) loses its lease and the job is retried, up to the
-- caller's attempt limit.

alter table app.upload_sessions drop constraint upload_sessions_kind_check;
alter table app.upload_sessions add constraint upload_sessions_kind_check
  check (kind in ('property_image', 'property_document', 'property_video'));

create table public.property_videos (
  id uuid primary key,
  property_id uuid not null references public.properties (id) on delete restrict,
  storage_bucket text not null,
  -- The quarantine upload the renditions are made from; cleared once the
  -- video is ready, failed or removed (the caller deletes the object).
  source_key text check (source_key is null or source_key ~ '^quarantine/'),
  source_container text not null check (source_container in ('mov', 'matroska')),
  source_byte_size bigint not null check (source_byte_size > 0),
  hls_prefix text not null unique check (hls_prefix ~ '^videos/'),
  state text not null default 'processing' check (state in ('processing', 'ready', 'failed')),
  error_code text check (error_code is null or char_length(error_code) <= 60),
  duration_seconds numeric(7, 2) check (duration_seconds is null or duration_seconds > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  poster_path text check (poster_path is null or poster_path ~ '^videos/'),
  -- Once ready: every encode job's result, ordered by rendition and chunk:
  -- [{rendition, chunk, codecs, width, height, init, init_sha, segments: [{f, d, b}]}].
  outputs jsonb not null default '[]'::jsonb check (jsonb_typeof(outputs) = 'array'),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  check (state <> 'ready' or (
    poster_path is not null and duration_seconds is not null and jsonb_array_length(outputs) > 0))
);

create unique index property_videos_one_per_listing_idx on public.property_videos (property_id) where removed_at is null;
create index property_videos_processing_idx on public.property_videos (created_at) where state = 'processing';
create index property_videos_orphan_source_idx on public.property_videos (removed_at)
  where removed_at is not null and source_key is not null;

create table app.video_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.property_videos (id) on delete cascade,
  kind text not null check (kind in ('prepare', 'encode')),
  -- A video quality ('720p') or the audio track ('audio'), and a time chunk.
  rendition text check (rendition is null or rendition ~ '^([0-9]{3,4}p|audio)$'),
  chunk integer check (chunk is null or chunk between 0 and 99),
  params jsonb not null default '{}'::jsonb,
  state text not null default 'queued' check (state in ('queued', 'running', 'done', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  result jsonb,
  error_code text check (error_code is null or char_length(error_code) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'encode') = (rendition is not null and chunk is not null)),
  unique nulls not distinct (video_id, kind, rendition, chunk)
);

create index video_jobs_active_idx on app.video_jobs (updated_at) where state in ('queued', 'running');

------------------------------------------------------------------------------
-- Visibility: same rule as listing photos. Anonymous callers see videos of
-- public listings only (the EXISTS runs under their properties policy);
-- owners see their own, admins see all. Delivery also requires `ready`.
------------------------------------------------------------------------------

alter table public.property_videos enable row level security;
revoke all on public.property_videos from anon, authenticated;
grant select on public.property_videos to anon, authenticated;

create policy property_videos_select on public.property_videos for select to anon, authenticated
  using (
    (removed_at is null and exists (select 1 from public.properties p where p.id = property_videos.property_id))
    or (select app.is_admin()));

------------------------------------------------------------------------------
-- Upload sessions: videos count against their own one-per-listing limit. A
-- failed video does not block its replacement.
------------------------------------------------------------------------------

create or replace function public.upload_session_create(
  p_actor_id uuid,
  p_property_id uuid,
  p_kind text,
  p_document_type text,
  p_declared_size integer,
  p_declared_mime text,
  p_original_filename text,
  p_bucket text,
  p_max_items integer,
  p_ttl_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing integer;
  v_limit record;
  v_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + make_interval(secs => p_ttl_seconds);
begin
  if p_kind not in ('property_image', 'property_document', 'property_video') then
    perform app.fail('VALIDATION_FAILED', 'kind');
  end if;
  perform app.lock_editable_listing(p_actor_id, p_property_id);

  select * into v_limit from app.rate_limit_consume('upload_initiate', p_actor_id::text);
  if not v_limit.allowed then
    perform app.fail('RATE_LIMITED', v_limit.retry_after_seconds::text);
  end if;

  -- In-flight sessions count toward the limit so parallel uploads cannot
  -- exceed it (MEDIA-002). The listing row lock serializes this check.
  v_existing :=
    case p_kind
      when 'property_image' then
        (select count(*) from public.property_media m where m.property_id = p_property_id and m.removed_at is null)
      when 'property_video' then
        (select count(*) from public.property_videos v
          where v.property_id = p_property_id and v.removed_at is null and v.state <> 'failed')
      else
        (select count(*) from public.property_documents d where d.property_id = p_property_id and d.removed_at is null)
    end
    + (select count(*) from app.upload_sessions s
        where s.property_id = p_property_id and s.kind = p_kind
          and s.state in ('initiated', 'processing') and s.expires_at > now());
  if v_existing >= p_max_items then
    perform app.fail('UPLOAD_LIMIT_REACHED', p_max_items::text);
  end if;

  insert into app.upload_sessions (id, actor_id, property_id, kind, document_type, bucket, quarantine_key,
                                   declared_size, declared_mime, original_filename, expires_at)
  values (v_id, p_actor_id, p_property_id, p_kind, p_document_type, p_bucket, 'quarantine/' || v_id,
          p_declared_size, p_declared_mime, p_original_filename, v_expires);

  return jsonb_build_object('session_id', v_id, 'quarantine_key', 'quarantine/' || v_id, 'expires_at', v_expires);
end;
$$;

-- Creates the video in `processing` and its `prepare` job. The quarantine
-- object stays as the transcode source (the session is finalized, so upload
-- maintenance never deletes it).
create or replace function public.upload_session_finalize_video(
  p_session_id uuid,
  p_actor_id uuid,
  p_lease_token uuid,
  p_video_id uuid,
  p_container text,
  p_byte_size bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s app.upload_sessions%rowtype;
  v_job uuid;
begin
  v_s := app.lock_session_for_lease(p_session_id, p_actor_id, p_lease_token);
  if v_s.state = 'finalized' then
    select j.id into v_job from app.video_jobs j where j.video_id = v_s.result_id and j.kind = 'prepare';
    return jsonb_build_object('id', v_s.result_id, 'replayed', true, 'job_id', v_job);
  end if;
  if v_s.kind <> 'property_video' then
    perform app.fail('VALIDATION_FAILED', 'kind');
  end if;
  perform app.lock_editable_listing(p_actor_id, v_s.property_id);

  update public.property_videos set removed_at = now()
   where property_id = v_s.property_id and removed_at is null and state = 'failed';
  if exists (select 1 from public.property_videos v where v.property_id = v_s.property_id and v.removed_at is null) then
    perform app.fail('UPLOAD_LIMIT_REACHED', '1');
  end if;

  insert into public.property_videos (id, property_id, storage_bucket, source_key, source_container,
                                      source_byte_size, hls_prefix, uploaded_by)
  values (p_video_id, v_s.property_id, v_s.bucket, v_s.quarantine_key, p_container,
          p_byte_size, 'videos/' || v_s.property_id || '/' || p_video_id, p_actor_id);
  insert into app.video_jobs (video_id, kind) values (p_video_id, 'prepare') returning id into v_job;

  update app.upload_sessions
     set state = 'finalized', result_id = p_video_id, finalized_at = now(), lease_until = null, lease_token = null
   where id = v_s.id;
  return jsonb_build_object('id', p_video_id, 'replayed', false, 'job_id', v_job);
end;
$$;

------------------------------------------------------------------------------
-- Transcode jobs (service_role only).
------------------------------------------------------------------------------

-- Marks a processing video failed, cancels its open jobs and hands back the
-- source object for the caller to delete.
create or replace function app.fail_video(p_video_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.property_videos%rowtype;
begin
  select * into v_v from public.property_videos where id = p_video_id for update;
  if not found or v_v.state <> 'processing' then
    return jsonb_build_object('bucket', v_v.storage_bucket, 'source_key', null);
  end if;
  update public.property_videos
     set state = 'failed', error_code = left(p_code, 60), source_key = null
   where id = p_video_id;
  update app.video_jobs
     set state = 'failed', error_code = coalesce(error_code, 'video_failed'), lease_token = null, lease_until = null,
         updated_at = now()
   where video_id = p_video_id and state in ('queued', 'running');
  return jsonb_build_object('bucket', v_v.storage_bucket, 'source_key', v_v.source_key);
end;
$$;

-- A removed video's jobs stop; its source goes back to the caller once.
create or replace function app.release_removed_video(p_video_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.property_videos%rowtype;
begin
  select * into v_v from public.property_videos where id = p_video_id for update;
  update public.property_videos set source_key = null where id = p_video_id;
  update app.video_jobs
     set state = 'failed', error_code = 'video_removed', lease_token = null, lease_until = null, updated_at = now()
   where video_id = p_video_id and state in ('queued', 'running');
  return jsonb_build_object('bucket', v_v.storage_bucket, 'source_key', v_v.source_key);
end;
$$;

-- Takes a lease on a job. Returns claimed=false (never an error) when there
-- is nothing to do, so duplicate kicks are harmless.
create or replace function public.video_job_claim(p_job_id uuid, p_lease_seconds integer, p_max_attempts integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j app.video_jobs%rowtype;
  v_v public.property_videos%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select * into v_j from app.video_jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;
  if v_j.state in ('done', 'failed') then
    return jsonb_build_object('claimed', false, 'reason', v_j.state);
  end if;
  if v_j.state = 'running' and v_j.lease_until > now() then
    return jsonb_build_object('claimed', false, 'reason', 'running');
  end if;

  select * into v_v from public.property_videos where id = v_j.video_id for update;
  if v_v.removed_at is not null then
    return jsonb_build_object('claimed', false, 'reason', 'removed', 'cleanup', app.release_removed_video(v_v.id));
  end if;
  if v_v.state <> 'processing' then
    update app.video_jobs set state = 'failed', error_code = 'video_' || v_v.state, lease_token = null,
                              lease_until = null, updated_at = now()
     where id = v_j.id;
    return jsonb_build_object('claimed', false, 'reason', 'video_' || v_v.state);
  end if;
  -- Out of attempts, typically because every attempt hit the time limit.
  if v_j.attempts >= p_max_attempts then
    update app.video_jobs set error_code = coalesce(error_code, 'attempts_exhausted') where id = v_j.id;
    return jsonb_build_object('claimed', false, 'reason', 'exhausted',
                              'cleanup', app.fail_video(v_v.id, coalesce(v_j.error_code, 'attempts_exhausted')));
  end if;

  update app.video_jobs
     set state = 'running', attempts = attempts + 1, lease_token = v_token,
         lease_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
   where id = v_j.id;

  return jsonb_build_object(
    'claimed', true, 'lease_token', v_token, 'kind', v_j.kind, 'rendition', v_j.rendition, 'chunk', v_j.chunk,
    'params', v_j.params, 'attempt', v_j.attempts + 1,
    'video', jsonb_build_object(
      'id', v_v.id, 'property_id', v_v.property_id, 'bucket', v_v.storage_bucket, 'source_key', v_v.source_key,
      'container', v_v.source_container, 'hls_prefix', v_v.hls_prefix));
end;
$$;

-- Locks a running job for its lease holder, or fails with UPLOAD_LEASE_LOST.
create or replace function app.lock_video_job(p_job_id uuid, p_lease_token uuid)
returns app.video_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j app.video_jobs%rowtype;
begin
  select * into v_j from app.video_jobs where id = p_job_id for update;
  if not found or v_j.state <> 'running' or v_j.lease_token is distinct from p_lease_token then
    perform app.fail('UPLOAD_LEASE_LOST');
  end if;
  return v_j;
end;
$$;

-- `prepare` succeeded: store what the probe found and queue the encode jobs.
-- p_jobs: [{rendition, chunk, params}].
create or replace function public.video_job_prepared(
  p_job_id uuid,
  p_lease_token uuid,
  p_duration_seconds numeric,
  p_width integer,
  p_height integer,
  p_poster_path text,
  p_jobs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j app.video_jobs%rowtype;
  v_v public.property_videos%rowtype;
begin
  v_j := app.lock_video_job(p_job_id, p_lease_token);
  if v_j.kind <> 'prepare' then
    perform app.fail('VALIDATION_FAILED', 'kind');
  end if;
  if jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) not between 1 and 200
     or exists (select 1 from jsonb_array_elements(p_jobs) r
                 where coalesce(r ->> 'rendition', '') !~ '^([0-9]{3,4}p|audio)$'
                    or coalesce(r ->> 'chunk', '') !~ '^[0-9]{1,2}$'
                    or jsonb_typeof(r -> 'params') is distinct from 'object') then
    perform app.fail('VALIDATION_FAILED', 'jobs');
  end if;

  select * into v_v from public.property_videos where id = v_j.video_id for update;
  if v_v.removed_at is not null or v_v.state <> 'processing' then
    update app.video_jobs set state = 'failed', error_code = 'video_inactive', lease_token = null, lease_until = null,
                              updated_at = now()
     where id = v_j.id;
    return jsonb_build_object('ok', false,
      'cleanup', case when v_v.removed_at is not null then app.release_removed_video(v_v.id) end);
  end if;

  update public.property_videos
     set duration_seconds = p_duration_seconds, width = p_width, height = p_height, poster_path = p_poster_path
   where id = v_v.id;
  insert into app.video_jobs (video_id, kind, rendition, chunk, params)
  select v_v.id, 'encode', r ->> 'rendition', (r ->> 'chunk')::integer, r -> 'params' from jsonb_array_elements(p_jobs) r
  on conflict do nothing;
  update app.video_jobs
     set state = 'done', lease_token = null, lease_until = null, error_code = null, updated_at = now()
   where id = v_j.id;

  return jsonb_build_object('ok', true, 'job_ids', (
    select coalesce(jsonb_agg(j.id order by j.rendition, j.chunk), '[]'::jsonb) from app.video_jobs j
     where j.video_id = v_v.id and j.kind = 'encode' and j.state = 'queued'));
end;
$$;

-- An encode job finished. The last one makes the video ready and releases
-- the source. p_result: {rendition, chunk, codecs, init, segments: [...], ...}.
create or replace function public.video_job_encode_done(p_job_id uuid, p_lease_token uuid, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j app.video_jobs%rowtype;
  v_v public.property_videos%rowtype;
begin
  v_j := app.lock_video_job(p_job_id, p_lease_token);
  if v_j.kind <> 'encode' or p_result ->> 'rendition' is distinct from v_j.rendition
     or p_result ->> 'chunk' is distinct from v_j.chunk::text
     or jsonb_typeof(p_result -> 'segments') is distinct from 'array' then
    perform app.fail('VALIDATION_FAILED', 'result');
  end if;

  select * into v_v from public.property_videos where id = v_j.video_id for update;
  if v_v.removed_at is not null or v_v.state <> 'processing' then
    update app.video_jobs set state = 'failed', error_code = 'video_inactive', lease_token = null, lease_until = null,
                              updated_at = now()
     where id = v_j.id;
    return jsonb_build_object('ok', false, 'ready', false,
      'cleanup', case when v_v.removed_at is not null then app.release_removed_video(v_v.id) end);
  end if;

  update app.video_jobs
     set state = 'done', result = p_result, lease_token = null, lease_until = null, error_code = null, updated_at = now()
   where id = v_j.id;

  if exists (select 1 from app.video_jobs j where j.video_id = v_v.id and j.kind = 'encode' and j.state <> 'done') then
    return jsonb_build_object('ok', true, 'ready', false);
  end if;

  update public.property_videos
     set state = 'ready', ready_at = now(), source_key = null,
         outputs = (select jsonb_agg(j.result order by j.rendition, j.chunk)
                      from app.video_jobs j where j.video_id = v_v.id and j.kind = 'encode')
   where id = v_v.id;
  return jsonb_build_object('ok', true, 'ready', true,
    'cleanup', jsonb_build_object('bucket', v_v.storage_bucket, 'source_key', v_v.source_key));
end;
$$;

-- A job attempt failed. Retryable failures go back to the queue until the
-- attempt limit; anything else fails the whole video.
create or replace function public.video_job_fail(
  p_job_id uuid, p_lease_token uuid, p_error_code text, p_retryable boolean, p_max_attempts integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j app.video_jobs%rowtype;
begin
  select * into v_j from app.video_jobs where id = p_job_id for update;
  if not found or v_j.state <> 'running' or v_j.lease_token is distinct from p_lease_token then
    return jsonb_build_object('ok', false, 'retry', false);
  end if;
  if p_retryable and v_j.attempts < p_max_attempts then
    update app.video_jobs
       set state = 'queued', error_code = left(p_error_code, 60), lease_token = null, lease_until = null, updated_at = now()
     where id = v_j.id;
    return jsonb_build_object('ok', true, 'retry', true);
  end if;
  update app.video_jobs
     set state = 'failed', error_code = left(p_error_code, 60), lease_token = null, lease_until = null, updated_at = now()
   where id = v_j.id;
  return jsonb_build_object('ok', true, 'retry', false, 'cleanup', app.fail_video(v_j.video_id, p_error_code));
end;
$$;

-- Jobs that should be running but are not: queued and not picked up for
-- p_stale_seconds, or running with an expired lease. One video, or all.
create or replace function public.video_jobs_stalled(p_video_id uuid, p_stale_seconds integer, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.id), '[]'::jsonb) from (
    select j.id from app.video_jobs j
     where j.state in ('queued', 'running')
       and (p_video_id is null or j.video_id = p_video_id)
       and ((j.state = 'queued' and j.updated_at < now() - make_interval(secs => p_stale_seconds))
            or (j.state = 'running' and j.lease_until < now()))
     order by j.updated_at
     limit least(greatest(p_limit, 1), 500)
  ) s
$$;

-- Daily safety net: fails videos stuck in processing and releases sources of
-- removed videos. Returns the objects to delete.
create or replace function public.video_maintenance(p_stuck_after_seconds integer, p_batch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch integer := least(greatest(p_batch, 1), 500);
  v_cleanup jsonb := '[]'::jsonb;
  r record;
begin
  for r in
    select v.id from public.property_videos v
     where v.state = 'processing' and v.removed_at is null
       and v.created_at < now() - make_interval(secs => p_stuck_after_seconds)
     order by v.created_at limit v_batch
  loop
    v_cleanup := v_cleanup || jsonb_build_array(app.fail_video(r.id, 'processing_timeout'));
  end loop;
  for r in
    select v.id from public.property_videos v
     where v.removed_at is not null and v.source_key is not null
     order by v.removed_at limit v_batch
  loop
    v_cleanup := v_cleanup || jsonb_build_array(app.release_removed_video(r.id));
  end loop;
  return jsonb_build_object('cleanup', (
    select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(v_cleanup) c where c ->> 'source_key' is not null));
end;
$$;

------------------------------------------------------------------------------
-- Owner removal (authenticated). Same review lock as photos.
------------------------------------------------------------------------------

create or replace function public.remove_property_video(p_video_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_property_id uuid;
begin
  if v_actor is null then
    perform app.fail('AUTH_REQUIRED');
  end if;
  select v.property_id into v_property_id from public.property_videos v
   where v.id = p_video_id and v.removed_at is null;
  if not found then
    perform app.fail('MEDIA_NOT_FOUND');
  end if;
  perform app.lock_editable_listing(v_actor, v_property_id);
  update public.property_videos set removed_at = now() where id = p_video_id;
  update app.video_jobs
     set state = 'failed', error_code = 'video_removed', lease_token = null, lease_until = null, updated_at = now()
   where video_id = p_video_id and state = 'queued';
  return jsonb_build_object('video_id', p_video_id, 'removed', true);
end;
$$;

------------------------------------------------------------------------------
-- Submission waits for a processing video, so reviewers always see the video
-- that will be published.
------------------------------------------------------------------------------

create or replace function app.property_submission_gaps(p public.properties)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with photos as (
    select
      count(*) as total,
      count(*) filter (where m.height >= m.width * 1.2) as portrait,
      count(*) filter (where m.width >= m.height * 1.2) as landscape,
      bool_or(m.is_cover) as has_cover
    from public.property_media m
    where m.property_id = p.id and m.removed_at is null
  )
  select array_remove(array[
    case when p.title is null or char_length(btrim(p.title)) < 10 then 'title' end,
    case when p.description is null or char_length(btrim(p.description)) < 50 then 'description' end,
    case when app.text_has_contact_details(coalesce(p.title, '') || ' ' || coalesce(p.description, '')) then 'contact_details' end,
    case when p.property_type is null then 'property_type' end,
    case when p.seller_type is null then 'seller_type' end,
    case when p.price is null then 'price' end,
    case when p.area_value is null or p.area_unit is null then 'area' end,
    case when p.location_id is null or not p.location_active then 'location' end,
    case when (select total from photos) < 4 then 'photos' end,
    case when (select portrait from photos) < 1 then 'photo_portrait' end,
    case when (select landscape from photos) < 1 then 'photo_landscape' end,
    case when not coalesce((select has_cover from photos), false) then 'cover_photo' end,
    case when not exists (
      select 1 from public.property_documents d where d.property_id = p.id and d.removed_at is null) then 'documents' end,
    case when exists (
      select 1 from app.upload_sessions s
      where s.property_id = p.id and s.state in ('initiated', 'processing') and s.expires_at > now()) then 'uploads_in_progress' end,
    case when exists (
      select 1 from public.property_videos v
      where v.property_id = p.id and v.removed_at is null and v.state = 'processing') then 'video_processing' end
  ], null)
$$;

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------

revoke all on app.video_jobs from public, anon, authenticated, service_role;

revoke execute on function
  app.fail_video(uuid, text),
  app.release_removed_video(uuid),
  app.lock_video_job(uuid, uuid),
  public.upload_session_finalize_video(uuid, uuid, uuid, uuid, text, bigint),
  public.video_job_claim(uuid, integer, integer),
  public.video_job_prepared(uuid, uuid, numeric, integer, integer, text, jsonb),
  public.video_job_encode_done(uuid, uuid, jsonb),
  public.video_job_fail(uuid, uuid, text, boolean, integer),
  public.video_jobs_stalled(uuid, integer, integer),
  public.video_maintenance(integer, integer),
  public.remove_property_video(uuid)
from public, anon, authenticated;

grant execute on function
  public.upload_session_finalize_video(uuid, uuid, uuid, uuid, text, bigint),
  public.video_job_claim(uuid, integer, integer),
  public.video_job_prepared(uuid, uuid, numeric, integer, integer, text, jsonb),
  public.video_job_encode_done(uuid, uuid, jsonb),
  public.video_job_fail(uuid, uuid, text, boolean, integer),
  public.video_jobs_stalled(uuid, integer, integer),
  public.video_maintenance(integer, integer)
to service_role;

grant execute on function public.remove_property_video(uuid) to authenticated;
