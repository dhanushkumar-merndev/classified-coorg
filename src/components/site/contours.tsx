import { cn } from "@/lib/utils";

// Topographic contour lines: a nod to Coorg's hill terrain. Deterministic
// (no randomness), so server and client render identical markup.
function ring(cx: number, cy: number, r: number, phase: number, squash: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const rr = r * (1 + 0.09 * Math.sin(3 * t + phase) + 0.05 * Math.sin(5 * t + phase * 1.7) + 0.03 * Math.cos(7 * t - phase));
    pts.push(`${(cx + rr * Math.cos(t)).toFixed(1)},${(cy + rr * Math.sin(t) * squash).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

const PEAKS = [
  { cx: 380, cy: 250, rings: 11, step: 26, phase: 0.4, squash: 0.72 },
  { cx: 150, cy: 430, rings: 7, step: 24, phase: 2.1, squash: 0.8 },
];

export function Contours({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 560" aria-hidden="true" className={cn("pointer-events-none", className)} fill="none">
      {PEAKS.flatMap((p, pi) =>
        Array.from({ length: p.rings }, (_, i) => (
          <path key={`${pi}-${i}`} d={ring(p.cx, p.cy, 14 + i * p.step, p.phase + i * 0.35, p.squash)}
            stroke="currentColor" strokeWidth={i % 4 === 3 ? 1.3 : 0.8} strokeOpacity={i % 4 === 3 ? 0.55 : 0.3} />
        )),
      )}
    </svg>
  );
}
