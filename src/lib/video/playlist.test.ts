import { describe, expect, test } from "vitest";
import {
  buildMasterPlaylist, buildMediaPlaylist, groupTracks, readChunkPlaylist, readCodecs, safePath, type EncodeOutput,
} from "./playlist";

const seg = (rendition: string, chunk: number, i: number, d: number, b: number) =>
  ({ f: `${rendition}/c${chunk}/seg_${String(i).padStart(3, "0")}.m4s`, d, b });

function output(rendition: string, chunk: number, segments: EncodeOutput["segments"], extra: Partial<EncodeOutput> = {}): EncodeOutput {
  return {
    rendition, chunk, codecs: rendition === "audio" ? "mp4a.40.2" : "avc1.64001f",
    init: `${rendition}/c${chunk}/init.mp4`, init_sha: "same", segments, ...extra,
  };
}

const OUTPUTS: EncodeOutput[] = [
  output("1080p", 0, [seg("1080p", 0, 0, 4, 2_500_000), seg("1080p", 0, 1, 4, 2_000_000)], { width: 1920, height: 1080, codecs: "avc1.640028" }),
  output("1080p", 1, [seg("1080p", 1, 0, 4, 2_000_000), seg("1080p", 1, 1, 0.1, 400_000)], { width: 1920, height: 1080, codecs: "avc1.640028" }),
  output("360p", 0, [seg("360p", 0, 0, 4, 400_000), seg("360p", 0, 1, 4, 400_000)], { width: 640, height: 360 }),
  output("360p", 1, [seg("360p", 1, 0, 4, 400_000), seg("360p", 1, 1, 0.1, 10_000)], { width: 640, height: 360 }),
  output("720p", 0, [seg("720p", 0, 0, 4, 1_000_000), seg("720p", 0, 1, 4, 1_000_000)], { width: 1280, height: 720 }),
  output("720p", 1, [seg("720p", 1, 0, 4, 1_000_000), seg("720p", 1, 1, 0.1, 20_000)], { width: 1280, height: 720 }),
  output("audio", 0, [seg("audio", 0, 0, 4, 64_000), seg("audio", 0, 1, 4, 64_000), seg("audio", 0, 2, 4.1, 64_000)]),
];

describe("reading encoder output", () => {
  test("parses a chunk playlist written by ffmpeg", () => {
    const text = [
      "#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-TARGETDURATION:4", "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:VOD",
      "#EXT-X-INDEPENDENT-SEGMENTS", '#EXT-X-MAP:URI="init.mp4"', "#EXTINF:4.000000,", "seg_000.m4s",
      "#EXTINF:2.500000,", "seg_001.m4s", "#EXT-X-ENDLIST", "",
    ].join("\n");
    expect(readChunkPlaylist(text)).toEqual({
      init: "init.mp4",
      segments: [{ file: "seg_000.m4s", duration: 4 }, { file: "seg_001.m4s", duration: 2.5 }],
    });
  });

  test("reads CODECS from the single-variant master", () => {
    expect(readCodecs('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3220800,RESOLUTION=1280x720,CODECS="avc1.64001f"\nindex.m3u8\n'))
      .toBe("avc1.64001f");
    expect(() => readCodecs('#EXT-X-STREAM-INF:CODECS="avc1\\"\n,x"')).toThrow();
  });
});

describe("master playlist", () => {
  test("lists qualities with a 720p lead, audio group, and bandwidth including audio", () => {
    const master = buildMasterPlaylist(OUTPUTS);
    const lines = master.trim().split("\n");
    expect(lines.slice(0, 4)).toEqual([
      "#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="audio/index.m3u8"',
    ]);
    expect(lines.filter((l) => !l.startsWith("#"))).toEqual(["720p/index.m3u8", "1080p/index.m3u8", "360p/index.m3u8"]);
    // 1080p peak: 2.5 MB in 4 s = 5 Mbit/s; the 0.1 s tail segment is ignored.
    // Audio peak: 64 kB in 4 s = 128 kbit/s.
    expect(master).toContain('#EXT-X-STREAM-INF:BANDWIDTH=5128000,AVERAGE-BANDWIDTH=');
    expect(master).toContain('RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"');
  });

  test("a video without sound has no audio group", () => {
    const master = buildMasterPlaylist(OUTPUTS.filter((o) => o.rendition !== "audio"));
    expect(master).not.toContain("EXT-X-MEDIA");
    expect(master).toContain('CODECS="avc1.64001f"\n720p/index.m3u8');
  });
});

describe("media playlist", () => {
  test("stitches chunks into one continuous VOD playlist with signed URIs", async () => {
    const { video } = groupTracks(OUTPUTS);
    const track = video.find((t) => t.rendition === "720p")!;
    const text = await buildMediaPlaylist(track, async (p) => `https://bucket.example/${p}?sig=1`);
    expect(text.trim().split("\n")).toEqual([
      "#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-TARGETDURATION:4", "#EXT-X-MEDIA-SEQUENCE:0",
      "#EXT-X-PLAYLIST-TYPE:VOD", "#EXT-X-INDEPENDENT-SEGMENTS",
      '#EXT-X-MAP:URI="https://bucket.example/720p/c0/init.mp4?sig=1"',
      "#EXTINF:4.000000,", "https://bucket.example/720p/c0/seg_000.m4s?sig=1",
      "#EXTINF:4.000000,", "https://bucket.example/720p/c0/seg_001.m4s?sig=1",
      "#EXTINF:4.000000,", "https://bucket.example/720p/c1/seg_000.m4s?sig=1",
      "#EXTINF:0.100000,", "https://bucket.example/720p/c1/seg_001.m4s?sig=1",
      "#EXT-X-ENDLIST",
    ]);
  });

  test("declares a new init segment only when a chunk's differs", async () => {
    const outputs = [
      output("720p", 0, [seg("720p", 0, 0, 4, 1)], { width: 1280, height: 720, init_sha: "a" }),
      output("720p", 1, [seg("720p", 1, 0, 4, 1)], { width: 1280, height: 720, init_sha: "b" }),
    ];
    const text = await buildMediaPlaylist(groupTracks(outputs).video[0]!, async (p) => p);
    expect(text.match(/#EXT-X-MAP/g)).toHaveLength(2);
  });

  test("target duration covers the longest segment", async () => {
    const text = await buildMediaPlaylist(groupTracks(OUTPUTS).audio!, async (p) => p);
    expect(text).toContain("#EXT-X-TARGETDURATION:5");
  });

  test("refuses paths an encode job would never write", () => {
    expect(safePath("720p/c1/seg_003.m4s")).toBe("720p/c1/seg_003.m4s");
    for (const bad of ["../x.m4s", "720p/c1/../../secret.mp4", "720p/c1/seg.m3u8", "quarantine/abc", "720p/seg.m4s"]) {
      expect(() => safePath(bad)).toThrow();
    }
  });
});
