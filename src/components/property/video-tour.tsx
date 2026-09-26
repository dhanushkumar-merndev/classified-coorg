"use client";

import type HlsType from "hls.js";
import { Play, Settings2, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 1080×1920 portrait is "1080p": the short side names the quality. */
function levelLabel(width: number, height: number): string {
  return `${Math.min(width, height)}p`;
}

export function VideoTour({ title, src, posterUrl, durationSeconds, shortSide, className }: VideoTourProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const moduleRef = useRef<Promise<HlsModule> | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [choice, setChoice] = useState(AUTO);
  const [current, setCurrent] = useState<string | null>(null);

  const loadModule = () => (moduleRef.current ??= import("hls.js"));

  // Fetch hls.js shortly before the player scrolls into view.
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

  function attach(Hls: HlsModule["default"], video: HTMLVideoElement) {
    const hls = new Hls({
      // Do not fetch 1080p into a phone-sized player.
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
    hls.loadSource(src);
    hls.attachMedia(video);
  }

  async function start() {
    const video = videoRef.current;
    if (!video || started) return;
    setStarted(true);
    const mod = await loadModule().catch(() => null);
    const Hls = mod?.default;
    if (Hls?.isSupported()) {
      attach(Hls, video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setFailed(true);
      return;
    }
    video.play().catch(() => {
      // Autoplay refused (e.g. the gesture expired): controls are showing.
    });
  }

  function pick(value: string) {
    setChoice(value);
    // -1 hands control back to adaptive selection; a level index pins it.
    if (hlsRef.current) hlsRef.current.currentLevel = Number(value);
  }

  const hdLabel = shortSide && shortSide >= 1080 ? "Full HD" : shortSide && shortSide >= 720 ? "HD" : null;
  const autoLabel = choice === AUTO && current ? `Auto · ${current}` : choice === AUTO ? "Auto" : levels.find((l) => String(l.index) === choice)?.label;

  return (
    <div ref={containerRef} className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Video className="size-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">Video tour</span>
          {durationSeconds ? <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(durationSeconds)}</span> : null}
        </div>
        {hdLabel && (
          <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            {hdLabel}
          </span>
        )}
      </div>

      <div className="relative aspect-video w-full bg-neutral-950" onPointerEnter={() => void loadModule()}>
        <video
          ref={videoRef}
          poster={posterUrl}
          controls={started && !failed}
          playsInline
          preload="none"
          className="size-full object-contain"
          aria-label={`Video tour of ${title}`}
        />

        {!started && (
          <button
            type="button"
            onClick={start}
            className="group absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20 focus-visible:outline-none"
            aria-label={`Play video tour of ${title}`}
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-ring/50">
              <Play className="ml-1 size-7 fill-current" aria-hidden="true" />
            </span>
          </button>
        )}

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 text-center text-sm text-white" role="alert">
            This video can&rsquo;t be played right now. Please try again later.
          </div>
        )}

        {started && !failed && levels.length > 1 && (
          <div className="absolute right-2 top-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="bg-black/60 text-white hover:bg-black/75" aria-label="Video quality">
                  <Settings2 aria-hidden="true" />
                  <span className="tabular-nums">{autoLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuLabel>Quality</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={choice} onValueChange={pick}>
                  <DropdownMenuRadioItem value={AUTO}>
                    Auto{current && choice === AUTO ? <span className="ml-auto text-xs text-muted-foreground">{current}</span> : null}
                  </DropdownMenuRadioItem>
                  {levels.map((l) => (
                    <DropdownMenuRadioItem key={l.index} value={String(l.index)}>
                      {l.label}
                      {l.label === "1080p" && <span className="ml-auto text-xs text-muted-foreground">HD</span>}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

