import type { EChartsOption } from "echarts";

import type { LineSeries } from "./types";

function fmtNum(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2);
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

export function lineChartOption(series: LineSeries[]): EChartsOption {
  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: 36,
      top: series.length > 1 ? 32 : 12,
    },
    legend: series.length > 1 ? {} : undefined,
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: [number, number]; marker: string }>;
        if (!items.length) return "";
        const x = fmtNum(items[0]!.value[0]);
        const rows = items.map((p) => `${p.marker}${p.seriesName}: <b>${fmtNum(p.value[1])}</b>`).join("<br/>");
        return `<strong>${x}</strong><br/>${rows}`;
      },
    },
    xAxis: {
      type: "value",
      axisLabel: { formatter: fmtNum },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: fmtNum },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line" as const,
      data: s.points.map((p) => [p.x, p.y]),
      smooth: s.smooth ?? false,
      areaStyle: s.area ? {} : undefined,
      symbol: "none",
    })),
  };
}
