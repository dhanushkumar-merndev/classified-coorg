import { describe, expect, test } from "vitest";
import { VideoJobError, checkSource, planJobs, planLadder, readSourceInfo, videoFilter, type SourceInfo } from "./transcode";

const phone = (over: Partial<SourceInfo> = {}): SourceInfo => ({
  durationSeconds: 95.4, width: 1920, height: 1080, fps: 30, hasAudio: true, hdr: false, ...over,
});

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof VideoJobError ? error.code : "other";
  }
}

describe("probe results", () => {
  test("applies rotation, skips cover art, detects audio and HDR", () => {
    const info = readSourceInfo({
      format: { duration: "61.2" },
      streams: [
        { codec_type: "video", width: 600, height: 600, disposition: { attached_pic: 1 } },
        {
          codec_type: "video", width: 1920, height: 1080, avg_frame_rate: "30000/1001", color_transfer: "arib-std-b67",
          side_data_list: [{ rotation: -90 }],
        },
        { codec_type: "audio" },
      ],
    });
    expect(info).toEqual({ durationSeconds: 61.2, width: 1080, height: 1920, fps: 30000 / 1001, hasAudio: true, hdr: true });
  });

  test("a file without a picture is refused", () => {
    expect(code(() => readSourceInfo({ streams: [{ codec_type: "audio" }] }))).toBe("video_no_picture");
  });

  test("limits: length and resolution", () => {
    expect(code(() => checkSource(phone()))).toBeNull();
    expect(code(() => checkSource(phone({ durationSeconds: 121.9 })))).toBeNull(); // container rounding
    expect(code(() => checkSource(phone({ durationSeconds: 125 })))).toBe("video_too_long");
    expect(code(() => checkSource(phone({ durationSeconds: 0.4 })))).toBe("video_too_short");
    expect(code(() => checkSource(phone({ durationSeconds: Number.NaN })))).toBe("video_too_short");
    expect(code(() => checkSource(phone({ width: 3840, height: 2160 })))).toBeNull();
    expect(code(() => checkSource(phone({ width: 7680, height: 4320 })))).toBe("video_resolution_too_high");
    expect(code(() => checkSource(phone({ width: 320, height: 180 })))).toBe("video_resolution_too_low");
  });
});

describe("planning", () => {
  test("ladder never upscales and keeps portrait orientation", () => {
    expect(planLadder(phone()).map((r) => `${r.name} ${r.width}x${r.height}`)).toEqual(["1080p 1920x1080", "720p 1280x720", "360p 640x360"]);
    expect(planLadder(phone({ width: 1080, height: 1920 })).map((r) => `${r.width}x${r.height}`)).toEqual(["1080x1920", "720x1280", "360x640"]);
    expect(planLadder(phone({ width: 1280, height: 720 })).map((r) => r.name)).toEqual(["720p", "360p"]);
    expect(planLadder(phone({ width: 426, height: 240 })).map((r) => `${r.name} ${r.width}x${r.height}`)).toEqual(["240p 426x240"]);
  });

  test("one job per quality and 24 s chunk, plus audio; the last chunk runs to the cap", () => {
    const jobs = planJobs(phone({ durationSeconds: 95.4 }));
    const chunks = jobs.filter((j) => j.rendition === "720p");
    expect(chunks.map((j) => j.params.start)).toEqual([0, 24, 48, 72]);
    expect(chunks.map((j) => j.params.length)).toEqual([24, 24, 24, 122 - 72]);
    expect(jobs.filter((j) => j.rendition === "audio")).toEqual([
      { rendition: "audio", chunk: 0, params: { kind: "audio", start: 0, length: 122, audioKbps: 128 } },
    ]);
    expect(jobs).toHaveLength(3 * 4 + 1);
  });

  test("a sub-second remainder does not get its own chunk", () => {
    expect(planJobs(phone({ durationSeconds: 48.3, hasAudio: false })).filter((j) => j.rendition === "360p")).toHaveLength(2);
    expect(planJobs(phone({ durationSeconds: 49, hasAudio: false })).filter((j) => j.rendition === "360p")).toHaveLength(3);
  });

  test("4K and 60 fps sources use shorter chunks and cap the frame rate", () => {
    const uhd = planJobs(phone({ width: 3840, height: 2160, fps: 60, durationSeconds: 120 }));
    const top = uhd.filter((j) => j.rendition === "1080p");
    expect(top).toHaveLength(10);
    expect(top[0]!.params).toMatchObject({ kind: "video", length: 12, width: 1920, height: 1080, fps: 30 });
    expect(planJobs(phone()).find((j) => j.rendition === "1080p")!.params).toMatchObject({ fps: null });
  });

  test("HDR sources are tone-mapped to SDR", () => {
    expect(videoFilter({ width: 1280, height: 720, fps: null, hdr: false })).toBe("scale=1280:720:flags=bicubic,format=yuv420p,setsar=1");
    expect(videoFilter({ width: 1280, height: 720, fps: 30, hdr: true })).toMatch(/^fps=30,zscale=w=1280:h=720:t=linear.*tonemap=tonemap=hable/);
  });
});
