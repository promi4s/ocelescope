import type { EChartsOption } from "echarts";

import type { LinePoint } from "../lineChart/types";
import type { ViolinStats } from "./types";

function fmtNum(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2);
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

interface RenderItemAPI {
  coord(val: [number, number]): number[];
  size(val: [number, number]): number[];
  style(opts?: Record<string, unknown>): Record<string, unknown>;
}

export function violinChartOption(points: LinePoint[], stats: ViolinStats): EChartsOption {
  if (points.length === 0) return { series: [] };

  const maxDensity = Math.max(...points.map((p) => p.y));

  const renderItem = (_params: unknown, api: unknown) => {
    const a = api as RenderItemAPI;

    const centerX = a.coord([0, stats.median])[0]!;
    const halfWidth = a.size([1, 0])[0]! * 0.4;

    const right = points.map((p) => [centerX + (p.y / maxDensity) * halfWidth, a.coord([0, p.x])[1]!]);
    const left = [...points].reverse().map((p) => [centerX - (p.y / maxDensity) * halfWidth, a.coord([0, p.x])[1]!]);

    return {
      type: "polygon" as const,
      shape: { points: [...right, ...left] },
      style: a.style({ opacity: 0.5 }),
    };
  };

  return {
    grid: { containLabel: true, left: 16, right: 24, bottom: 36, top: 12 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = (params as Array<{ value: number[] }>).find((s) => s.value?.length === 5);
        if (!p) return "";
        const [min, q1, median, q3, max] = p.value;
        return [
          `Min: <b>${fmtNum(min!)}</b>`,
          `Q1: <b>${fmtNum(q1!)}</b>`,
          `Median: <b>${fmtNum(median!)}</b>`,
          `Q3: <b>${fmtNum(q3!)}</b>`,
          `Max: <b>${fmtNum(max!)}</b>`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: [""],
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: fmtNum },
      splitLine: { lineStyle: { type: "dashed" } },
    },
    series: [
      // Violin polygon — rendered behind the boxplot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: "custom", clip: false, renderItem, data: [[0, stats.median]], z: 1 } as any,
      {
        type: "boxplot",
        data: [[stats.min, stats.q1, stats.median, stats.q3, stats.max]],
        z: 2,
      },
    ],
  };
}
