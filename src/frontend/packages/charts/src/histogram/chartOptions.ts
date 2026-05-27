import type { EChartsOption } from "echarts";

import type { HistogramBin } from "./types";

function fmtNum(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2);
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

export function histogramOption(bins: HistogramBin[]): EChartsOption {
  const total = bins.reduce((sum, b) => sum + b.count, 0);
  const rotate = bins.length > 10 ? 35 : 0;

  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: 16,
      top: 12,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const [{ dataIndex = 0 } = {}] = params as Array<{ dataIndex: number }>;
        const bin = bins[dataIndex];
        if (!bin) return "";
        const pct = total > 0 ? ((bin.count / total) * 100).toFixed(1) : "0.0";
        return [
          `<strong>[${fmtNum(bin.start)}, ${fmtNum(bin.end)})</strong>`,
          `Count: <b>${bin.count.toLocaleString("en-US")}</b>`,
          `Share: <b>${pct}%</b>`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: bins.map((b) => fmtNum(b.start)),
      axisLabel: { rotate, overflow: "truncate", width: 100 },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 44,
    },
    series: [
      {
        name: "Histogram",
        type: "bar",
        data: bins.map((b) => b.count),
        barCategoryGap: "0%",
      },
    ],
  };
}
