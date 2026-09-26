"use client";

import type HlsType from "hls.js";
import { Loader2, Maximize, Minimize, Pause, Play, Settings2, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Adaptive (HLS) listing video. Nothing but the poster loads until the viewer
// presses play; hls.js is fetched once the player nears the viewport so the
// press starts playback at once. hls.js picks the quality from measured
// bandwidth and player size and switches as the connection changes; the menu
// can pin one. Browsers without Media Source Extensions (older iOS) play the
// same stream natively.

interface VideoTourProps {
  title: string;
  /** Master playlist URL (see videoUrl in lib/site). */
  src: string;
  posterUrl: string;
  durationSeconds?: number | null;
  /** Short side of the source, for the HD badge. */
  shortSide?: number | null;
  className?: string;
}

interface Level {
  index: number;
  label: string;
}

type HlsModule = typeof import("hls.js");

const AUTO = "-1";
const IDLE_TIMEOUT = 2500;

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 1080×1920 portrait is "1080p": the short side names the quality. */
function levelLabel(width: number, height: number): string {
  const short = Math.min(width, height);
  return short >= 2160 ? "2160p (4K)" : `${short}p`;
}

/** Check if the document is currently in fullscreen mode. */
function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ??
    (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
  );
}

/** Request fullscreen on an element, with vendor-prefix fallback. */
function requestFS(el: HTMLElement) {
  if (el.requestFullscreen) return el.requestFullscreen();
  const webkit = el as unknown as { webkitRequestFullscreen?: () => Promise<void> };
  if (webkit.webkitRequestFullscreen) return webkit.webkitRequestFullscreen();
}

/** Exit fullscreen, with vendor-prefix fallback. */
function exitFS() {
  if (document.exitFullscreen) return document.exitFullscreen();
  const webkit = document as unknown as { webkitExitFullscreen?: () => Promise<void> };
  if (webkit.webkitExitFullscreen) return webkit.webkitExitFullscreen();
}

export function VideoTour({ title, src, posterUrl, durationSeconds, shortSide: _shortSide, className }: VideoTourProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const moduleRef = useRef<Promise<HlsModule> | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [choice, setChoice] = useState(AUTO);
  const [current, setCurrent] = useState<string | null>(null);
  const [isFS, setIsFS] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [flashIcon, setFlashIcon] = useState<"play" | "pause" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Time & buffer state for the bottom bar.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const loadModule = () => (moduleRef.current ??= import("hls.js"));

  // ── Time tracking via rAF ─────────────────────────────────────────
  const updateTime = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        if (video.duration && Number.isFinite(video.duration)) setDuration(video.duration);
      }
      if (video.buffered && video.buffered.length > 0 && video.duration > 0) {
        for (let i = video.buffered.length - 1; i >= 0; i--) {
          if (video.buffered.start(i) <= video.currentTime) {
            setBufferedPercent((video.buffered.end(i) / video.duration) * 100);
            break;
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(updateTime);
  }, [isSeeking]);

  useEffect(() => {
    if (started && !failed) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [started, failed, updateTime]);

  // ── Idle-based auto-hide ──────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setShowControls(true);
    idleTimer.current = setTimeout(() => setShowControls(false), IDLE_TIMEOUT);
  }, []);

  const onPointerMove = useCallback(() => {
    if (started && !failed) resetIdleTimer();
  }, [started, failed, resetIdleTimer]);

  const onPointerLeave = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setShowControls(false), 600);
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────
  useEffect(() => {
    function onFSChange() { setIsFS(isFullscreen()); }
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
    };
  }, []);

  // ── Preload hls.js when the player nears the viewport ─────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        void loadModule();
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  // ── Sync playing state from the video element ─────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setBuffering(false); };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setPlaying(true); setBuffering(false); };
    const onCanPlay = () => setBuffering(false);
    const onSeeking = () => setBuffering(true);
    const onSeeked = () => setBuffering(false);
    const onEnded = () => { setPlaying(false); setBuffering(false); setShowControls(true); };
    const onDurationChange = () => {
      if (video.duration && Number.isFinite(video.duration)) setDuration(video.duration);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onEnded);
    video.addEventListener("durationchange", onDurationChange);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, []);

  function attach(Hls: HlsModule["default"], video: HTMLVideoElement) {
    const hls = new Hls({
      capLevelToPlayerSize: true,
      maxDevicePixelRatio: 2,
      startFragPrefetch: true,
      maxBufferLength: 20,
    });
    hlsRef.current = hls;
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      const list = data.levels
        .map((l, index) => ({ index, label: levelLabel(l.width, l.height), height: Math.min(l.width, l.height) }))
        .sort((a, b) => b.height - a.height);
      setLevels(list.map(({ index, label }) => ({ index, label })));
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const level = hls.levels[data.level];
      if (level) setCurrent(levelLabel(level.width, level.height));
    });
    let mediaRecoveries = 0;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 2) {
        hls.recoverMediaError();
      } else {
        hls.destroy();
        hlsRef.current = null;
        setFailed(true);
      }
    });
    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      setBuffering(false);
    });
    hls.loadSource(src);
    hls.attachMedia(video);
  }

  async function start() {
    const video = videoRef.current;
    if (!video || started) return;
    setStarted(true);
    setBuffering(true);
    const mod = await loadModule().catch(() => null);
    const Hls = mod?.default;
    if (Hls?.isSupported()) {
      attach(Hls, video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setBuffering(false);
      setFailed(true);
      return;
    }
    video.play().catch(() => {
      setBuffering(false);
    });
    resetIdleTimer();
  }

  function pick(value: string) {
    setChoice(value);
    if (hlsRef.current) hlsRef.current.currentLevel = Number(value);
  }

  // ── Flash the centered play/pause icon briefly ────────────────────
  const flash = useCallback((icon: "play" | "pause") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashIcon(icon);
    flashTimer.current = setTimeout(() => setFlashIcon(null), 600);
  }, []);

  // ── Toggle play/pause ─────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !started || failed) return;
    if (video.paused) {
      video.play().catch(() => {});
      flash("play");
    } else {
      video.pause();
      flash("pause");
    }
    resetIdleTimer();
  }, [started, failed, flash, resetIdleTimer]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen()) {
      void exitFS();
    } else if (playerRef.current) {
      void requestFS(playerRef.current);
    }
  }, []);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    toggleFullscreen();
  }, [toggleFullscreen]);

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVideoClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, [role=menu], [data-radix-popper-content-wrapper], [data-progress-bar]")) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => togglePlay(), 200);
  }, [togglePlay]);

  const onVideoDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-progress-bar]")) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    onDoubleClick(e);
  }, [onDoubleClick]);

  // ── Progress bar seeking ──────────────────────────────────────────
  const seekTo = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const onProgressPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsSeeking(true);
    seekTo(e);
    const onMove = (ev: PointerEvent) => {
      const bar = progressRef.current;
      const video = videoRef.current;
      if (!bar || !video || !duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      video.currentTime = ratio * duration;
      setCurrentTime(ratio * duration);
    };
    const onUp = () => {
      setIsSeeking(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [duration, seekTo]);

  const autoLabel = choice === AUTO && current ? `Auto · ${current}` : choice === AUTO ? "Auto" : levels.find((l) => String(l.index) === choice)?.label;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Controls visible when: not started (poster), cursor is active, or paused.
  const controlsVisible = !started || showControls || !playing;

  return (
    <div ref={containerRef} className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      {/* Player wrapper — this element goes fullscreen so overlays stay visible. */}
      <div
        ref={playerRef}
        className={cn("relative flex flex-col", isFS && "h-screen bg-black")}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={isFS ? { cursor: controlsVisible ? "default" : "none" } : undefined}
      >
        {/* ── Top bar: only in normal (non-fullscreen) mode ── */}
        {!isFS && (
          <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Video className="size-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">Video tour</span>
              {durationSeconds ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(durationSeconds)}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Video area ── */}
        <div
          className={cn("relative aspect-video w-full bg-neutral-950", isFS && "flex-1")}
          onPointerEnter={() => void loadModule()}
          onClick={started && !failed ? onVideoClick : undefined}
          onDoubleClick={started && !failed ? onVideoDoubleClick : undefined}
        >
          <video
            ref={videoRef}
            poster={posterUrl}
            playsInline
            preload="none"
            className="size-full object-contain"
            aria-label={`Video tour of ${title}`}
          />

          {/* ── Initial play button (before started) ── */}
          {!started && (
            <button
              type="button"
              onClick={start}
              className="group absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30 focus-visible:outline-none"
              aria-label={`Play video tour of ${title}`}
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-black/60 text-white shadow-xl backdrop-blur-xs transition-transform group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-white/50">
                <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
              </span>
            </button>
          )}

          {/* ── Error overlay ── */}
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 text-center text-sm text-white" role="alert">
              This video can&rsquo;t be played right now. Please try again later.
            </div>
          )}

          {/* ── Centered flash icon (play/pause feedback) ── */}
          {flashIcon && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <span className="flex size-16 animate-[flash-scale_0.5s_ease-out_forwards] items-center justify-center rounded-full bg-black/50 text-white">
                {flashIcon === "play"
                  ? <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
                  : <Pause className="size-7 fill-current" aria-hidden="true" />}
              </span>
            </div>
          )}

          {/* ── Buffer loader spinner ── */}
          {started && !failed && buffering && (
            <div className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-black/60 shadow-xl backdrop-blur-xs">
                <Loader2 className="size-8 animate-spin text-emerald-400" aria-label="Buffering..." />
              </div>
            </div>
          )}

          {/* ── Persistent center play button when paused ── */}
          {started && !failed && !playing && !flashIcon && !buffering && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-black/50 text-white">
                <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
              </span>
            </div>
          )}

          {/* ── Bottom bar: progress + time + controls ── */}
          {started && !failed && (
            <div
              data-progress-bar
              className={cn(
                "absolute inset-x-0 bottom-0 z-20 flex flex-col px-4 pb-3 pt-6 transition-opacity duration-300",
                !controlsVisible && "pointer-events-none opacity-0",
              )}
            >
              {/* Gradient scrim */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

              {/* Progress bar with horizontal padding (inset from edges) */}
              <div className="relative z-10 py-1">
                <div
                  ref={progressRef}
                  className="group relative flex h-4 cursor-pointer items-center"
                  onPointerDown={onProgressPointerDown}
                >
                  <div className="relative h-1 w-full rounded-full transition-all group-hover:h-1.5">
                    {/* Track */}
                    <div className="absolute inset-0 rounded-full bg-white/20" />
                    {/* Buffered range */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-white/40 transition-all duration-150"
                      style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
                    />
                    {/* Green played fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                      style={{ width: `${progress}%` }}
                    />
                    {/* Green pill / thumb */}
                    <div
                      className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 shadow-md ring-2 ring-emerald-400/40 transition-transform group-hover:scale-125"
                      style={{ left: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Time + controls row */}
              <div className="relative z-10 flex items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="flex size-8 shrink-0 items-center justify-center text-white hover:text-white/80"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing
                    ? <Pause className="size-4 fill-current" aria-hidden="true" />
                    : <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />}
                </button>
                <span className="text-xs tabular-nums text-white/90">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
                <div className="flex-1" />
                {levels.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium tabular-nums text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                        aria-label="Video quality"
                      >
                        <Settings2 className="size-3.5" aria-hidden="true" />
                        <span>{autoLabel}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      side="top"
                      sideOffset={8}
                      className="min-w-44 rounded-xl border border-white/10 bg-neutral-900/95 p-1.5 text-white shadow-2xl backdrop-blur-md ring-0"
                      container={isFS ? playerRef.current : undefined}
                    >
                      <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                        Quality
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="-mx-1.5 my-1 bg-white/10" />
                      <DropdownMenuRadioGroup value={choice} onValueChange={pick}>
                        <DropdownMenuRadioItem
                          value={AUTO}
                          className={cn(
                            "group cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 focus:bg-white/15 focus:text-white data-[state=checked]:text-emerald-400",
                            current && choice === AUTO
                              ? "[&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
                              : "pr-7 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-emerald-400",
                          )}
                        >
                          <span>Auto</span>
                          {current && choice === AUTO ? (
                            <span className="ml-auto text-xs text-white/50 transition-colors group-hover:text-emerald-400 group-focus:text-emerald-400 group-data-[highlighted]:text-emerald-400">
                              {current}
                            </span>
                          ) : null}
                        </DropdownMenuRadioItem>
                        {levels.map((l) => {
                          const hasRightText = l.label === "1080p";
                          return (
                            <DropdownMenuRadioItem
                              key={l.index}
                              value={String(l.index)}
                              className={cn(
                                "group cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 focus:bg-white/15 focus:text-white data-[state=checked]:text-emerald-400",
                                hasRightText
                                  ? "[&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
                                  : "pr-7 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-emerald-400",
                              )}
                            >
                              <span>{l.label}</span>
                              {l.label === "1080p" && (
                                <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 transition-colors group-hover:bg-emerald-500/20 group-hover:text-emerald-400 group-focus:bg-emerald-500/20 group-focus:text-emerald-400 group-data-[highlighted]:bg-emerald-500/20 group-data-[highlighted]:text-emerald-400">
                                  HD
                                </span>
                              )}
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                  className="flex size-8 shrink-0 items-center justify-center text-white hover:text-white/80"
                  aria-label={isFS ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFS ? <Minimize className="size-4" aria-hidden="true" /> : <Maximize className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
