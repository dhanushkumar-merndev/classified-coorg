// HLS playlists for listing videos. Pure functions: no I/O.
//
// Each quality is encoded as several time chunks (one job each) plus one audio
// track. Every job records its segment list; the playlists are assembled from
// those records on request, with each segment and init URI replaced by a
// short-lived signed URL to the private bucket. Chunks carry real timestamps
// (ffmpeg -output_ts_offset with movflags=frag_discont) and identical init
// segments, so they play as one continuous stream: no discontinuities.

/** A quality ("720p") or the audio track. */
export const RENDITION = /^(?:[0-9]{3,4}p|audio)$/;
/** Object paths inside a video's prefix, as written by the encode jobs. */
const OUTPUT_PATH = /^(?:[0-9]{3,4}p|audio)\/c[0-9]{1,2}\/[A-Za-z0-9_-]{1,64}\.(?:m4s|mp4)$/;
const CODECS = /^[A-Za-z0-9.,]{1,100}$/;

export interface OutputSegment {
  /** Path relative to the video prefix, e.g. "720p/c1/seg_003.m4s". */
  f: string;
  /** Duration in seconds. */
  d: number;
  /** Size in bytes. */
  b: number;
}

/** One encode job's result, as stored in property_videos.outputs. */
export interface EncodeOutput {
  rendition: string;
  chunk: number;
  codecs: string;
  width?: number;
  height?: number;
  init: string;
  init_sha: string;
  segments: OutputSegment[];
}

export interface Track {
  rendition: string;
  codecs: string;
  width: number;
  height: number;
  parts: Array<{ init: string; initSha: string; segments: OutputSegment[] }>;
  /** Highest segment bitrate (bits/s), ignoring very short tail segments. */
  peakBps: number;
  averageBps: number;
}

// --- reading encoder output -------------------------------------------------------

/** Parses the media playlist ffmpeg wrote for one chunk. */
export function readChunkPlaylist(text: string): { init: string; segments: Array<{ file: string; duration: number }> } {
  let init = "";
  let duration: number | null = null;
  const segments: Array<{ file: string; duration: number }> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const map = /^#EXT-X-MAP:URI="([^"]+)"/.exec(line);
    const inf = /^#EXTINF:([0-9.]+),/.exec(line);
    if (map) init = map[1]!;
    else if (inf) duration = Number(inf[1]);
    else if (line && !line.startsWith("#")) {
      if (duration === null || !Number.isFinite(duration)) throw new Error("segment_without_duration");
      segments.push({ file: line, duration });
      duration = null;
    }
  }
  if (!init) throw new Error("missing_init_segment");
  return { init, segments };
}

/** CODECS from the single-variant master playlist ffmpeg writes. */
export function readCodecs(master: string): string {
  const codecs = /CODECS="([^"]+)"/.exec(master)?.[1] ?? "";
  if (!CODECS.test(codecs)) throw new Error("missing_codecs");
  return codecs;
}

// --- assembling playlists ---------------------------------------------------------

/** Groups job outputs into playable tracks: video qualities best first. */
export function groupTracks(outputs: EncodeOutput[]): { video: Track[]; audio: Track | null } {
  const byRendition = new Map<string, EncodeOutput[]>();
  for (const o of outputs) {
    if (!RENDITION.test(o.rendition)) continue;
    byRendition.set(o.rendition, [...(byRendition.get(o.rendition) ?? []), o]);
  }
  const tracks: Track[] = [];
  for (const [rendition, chunks] of byRendition) {
    chunks.sort((a, b) => a.chunk - b.chunk);
    const parts = chunks
      .map((c) => ({ init: c.init, initSha: c.init_sha, segments: c.segments.filter((s) => s.d > 0) }))
      .filter((p) => p.segments.length > 0);
    const all = parts.flatMap((p) => p.segments);
    if (all.length === 0) continue;
    const seconds = all.reduce((t, s) => t + s.d, 0);
    const bytes = all.reduce((t, s) => t + s.b, 0);
    // A 0.1 s tail segment holding a keyframe would claim a huge bitrate and
    // push players to a lower quality than they can handle.
    const measured = all.filter((s) => s.d >= 1);
    const peakBps = Math.max(...(measured.length > 0 ? measured : all).map((s) => (s.b * 8) / s.d));
    tracks.push({
      rendition,
      codecs: chunks[0]!.codecs,
      width: chunks[0]!.width ?? 0,
      height: chunks[0]!.height ?? 0,
      parts,
      peakBps: Math.ceil(peakBps),
      averageBps: Math.ceil((bytes * 8) / seconds),
    });
  }
  const video = tracks.filter((t) => t.rendition !== "audio").sort((a, b) => b.width * b.height - a.width * a.height);
  return { video, audio: tracks.find((t) => t.rendition === "audio") ?? null };
}

/**
 * Master playlist. The first variant is what Safari plays first, so a middle
 * quality leads for a quick start; players then adapt. Variant and audio URIs
 * are relative ("720p/index.m3u8") and resolve to the same route.
 */
export function buildMasterPlaylist(outputs: EncodeOutput[]): string {
  const { video, audio } = groupTracks(outputs);
  const ordered = [...video];
  const lead = ordered.findIndex((t) => t.rendition === "720p");
  if (lead > 0) ordered.unshift(...ordered.splice(lead, 1));

  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];
  if (audio) {
    lines.push('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="audio/index.m3u8"');
  }
  for (const t of ordered) {
    const attrs = [
      `BANDWIDTH=${t.peakBps + (audio?.peakBps ?? 0)}`,
      `AVERAGE-BANDWIDTH=${t.averageBps + (audio?.averageBps ?? 0)}`,
      `RESOLUTION=${t.width}x${t.height}`,
      `CODECS="${[t.codecs, audio?.codecs].filter(Boolean).join(",")}"`,
      ...(audio ? ['AUDIO="audio"'] : []),
    ];
    lines.push(`#EXT-X-STREAM-INF:${attrs.join(",")}`, `${t.rendition}/index.m3u8`);
  }
  return `${lines.join("\n")}\n`;
}

/** VOD media playlist for one track; `sign` turns an output path into a URL. */
export async function buildMediaPlaylist(track: Track, sign: (path: string) => Promise<string>): Promise<string> {
  const all = track.parts.flatMap((p) => p.segments);
  const target = Math.max(1, Math.ceil(Math.max(...all.map((s) => s.d))));
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    `#EXT-X-TARGETDURATION:${target}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
  ];
  let currentInit: string | null = null;
  for (const part of track.parts) {
    // Chunks normally share byte-identical init segments: declare it once.
    if (part.initSha !== currentInit) {
      lines.push(`#EXT-X-MAP:URI="${await sign(safePath(part.init))}"`);
      currentInit = part.initSha;
    }
    for (const s of part.segments) {
      lines.push(`#EXTINF:${s.d.toFixed(6)},`, await sign(safePath(s.f)));
    }
  }
  lines.push("#EXT-X-ENDLIST");
  return `${lines.join("\n")}\n`;
}

/** Refuses anything that is not a path an encode job writes. */
export function safePath(path: string): string {
  if (!OUTPUT_PATH.test(path)) throw new Error("unexpected_output_path");
  return path;
}

export const HLS_CONTENT_TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  jpg: "image/jpeg",
};

export function contentTypeFor(file: string): string {
  return HLS_CONTENT_TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream";
}
