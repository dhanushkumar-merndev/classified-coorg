// The ffmpeg/ffprobe binary packages ship no type declarations.

declare module "ffmpeg-static" {
  /** Absolute path of the bundled ffmpeg, or null on an unsupported platform. */
  const path: string | null;
  export default path;
}

declare module "@ffprobe-installer/ffprobe" {
  const ffprobe: { path: string; version: string; url: string };
  export default ffprobe;
}
