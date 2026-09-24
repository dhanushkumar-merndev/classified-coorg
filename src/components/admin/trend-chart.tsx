"use client";

import { useEffect, useRef } from "react";

interface Point { label: string; value: number }

// ECharts is imported on demand so it never loads for pages without a chart.
export function TrendChart({ title, points, kind = "line" }: { title: string; points: Point[]; kind?: "line" | "bar" }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let chart: import("echarts/core").ECharts | undefined;
    let disposed = false;
    (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"), import("echarts/charts"), import("echarts/components"), import("echarts/renderers"),
      ]);
      if (disposed || !el.current) return;
      core.use([charts.LineChart, charts.BarChart, components.GridComponent, components.TooltipComponent, renderers.CanvasRenderer]);
      chart = core.init(el.current);
      chart.setOption({
        color: ["#1f5a3d"],
        grid: { left: 40, right: 16, top: 16, bottom: 28 },
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: points.map((p) => p.label), axisLabel: { color: "#5b6670" } },
        yAxis: { type: "value", minInterval: 1, axisLabel: { color: "#5b6670" } },
        series: [{ type: kind, data: points.map((p) => p.value), smooth: kind === "line", areaStyle: kind === "line" ? { opacity: 0.08 } : undefined }],
      });
    })();
    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);
    return () => { disposed = true; window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [points, kind]);

  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <figure className="rounded-xl border bg-card p-5">
      <figcaption className="mb-3 text-sm font-medium">{title}</figcaption>
      <div ref={el} className="h-64 w-full" role="img" aria-label={`${title}: ${total} in total`} />
      <table className="sr-only"><caption>{title}</caption><tbody>
        {points.map((p) => <tr key={p.label}><th>{p.label}</th><td>{p.value}</td></tr>)}
      </tbody></table>
    </figure>
  );
}
