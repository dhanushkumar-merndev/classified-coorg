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
        color: ["#24553b"],
        textStyle: { fontFamily: "var(--font-roboto), system-ui, sans-serif" },
        grid: { left: 32, right: 8, top: 12, bottom: 24 },
        tooltip: { trigger: "axis", borderColor: "#e2ddd0" },
        xAxis: {
          type: "category", data: points.map((p) => p.label),
          axisLine: { lineStyle: { color: "#cdc6b5" } }, axisTick: { show: false }, axisLabel: { color: "#62685e", fontSize: 11 },
        },
        yAxis: {
          type: "value", minInterval: 1,
          splitLine: { lineStyle: { color: "#ece8de" } }, axisLabel: { color: "#62685e", fontSize: 11 },
        },
        series: [{
          type: kind, data: points.map((p) => p.value), showSymbol: false, barMaxWidth: 28,
          lineStyle: { width: 2 }, areaStyle: kind === "line" ? { opacity: 0.08 } : undefined,
          itemStyle: kind === "bar" ? { borderRadius: [3, 3, 0, 0] } : undefined,
        }],
      });
    })();
    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);
    return () => { disposed = true; window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [points, kind]);


  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <figure className="relative rounded-md border bg-card p-5">
      <figcaption className="mb-3 flex items-baseline justify-between text-sm font-medium">
        {title}<span className="text-xl font-medium tracking-tight">{total}</span>
      </figcaption>
      {points.length === 0 ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div ref={el} className="h-64 w-full" role="img" aria-label={`${title}: ${total} in total`} />
      )}
      <div className="sr-only">
        <table><caption>{title}</caption><tbody>
          {points.map((p) => <tr key={p.label}><th>{p.label}</th><td>{p.value}</td></tr>)}
        </tbody></table>
      </div>
    </figure>
  );
}
