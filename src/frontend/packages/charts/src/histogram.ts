import type { EChartsOption } from "echarts";

import type { NumericRange } from "./types";

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
  inclusiveEnd?: boolean;
}

export interface HistogramData {
  bins: HistogramBin[];
  domain: NumericRange;
  covered: NumericRange;
  counts: {
    covered: number;
    missing: number;
    total: number;
  };
}

function fmtNum(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e5 || abs < 1e-3) return value.toExponential(2);
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

export function histogramOption(data: HistogramData): EChartsOption {
  const { bins, domain, counts } = data;
  const totalNonMissing = counts.total - counts.missing;
  const constantPadding = Math.max(Math.abs(domain.min) * 0.05, 0.5);
  const displayDomain =
    domain.min === domain.max
      ? {
          min: domain.min - constantPadding,
          max: domain.max + constantPadding,
        }
      : domain;

  // Bars on a numeric x-axis: each bar is placed at its bin center with an
  // explicit width spanning the bin extent. Numeric axis means dataZoom emits
  // real values, not bin indices.
  const seriesData = bins.map((b) => {
    const center = (b.start + b.end) / 2;
    const width = b.end - b.start;
    const displayStart = width === 0 ? center - constantPadding / 2 : b.start;
    const displayEnd = width === 0 ? center + constantPadding / 2 : b.end;
    return {
      value: [
        center,
        b.count,
        Math.max(width, Number.EPSILON),
        displayStart,
        displayEnd,
      ],
    };
  });

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
        const items = params as Array<{
          dataIndex: number;
          marker: string;
        }>;
        const item = items[0];
        if (!item) return "";
        const bin = bins[item.dataIndex];
        if (!bin) return "";
        const pct =
          totalNonMissing > 0
            ? ((bin.count / totalNonMissing) * 100).toFixed(1)
            : "0.0";
        return [
          `<strong>[${fmtNum(bin.start)}, ${fmtNum(bin.end)}${bin.inclusiveEnd ? "]" : ")"}</strong>`,
          `${item.marker}Count: <b>${bin.count.toLocaleString("en-US")}</b>`,
          `Share: <b>${pct}%</b>`,
        ].join("<br/>");
      },
    },
    graphic:
      counts.missing > 0
        ? [
            {
              type: "text",
              right: 16,
              top: 8,
              style: {
                text: `Missing: ${counts.missing.toLocaleString("en-US")} (${counts.total > 0 ? ((counts.missing / counts.total) * 100).toFixed(1) : "0.0"}%)`,
                fontSize: 12,
                fill: "#868e96",
              },
            },
          ]
        : undefined,
    xAxis: {
      type: "value",
      min: displayDomain.min,
      max: displayDomain.max,
      axisLabel: { formatter: fmtNum },
    },
    yAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 44,
    },
    series: [
      {
        id: "histogram-bars",
        name: "Histogram",
        type: "custom",
        renderItem: (_params, api) => {
          const xCenter = api.value(0) as number;
          const yValue = api.value(1) as number;
          const width = api.value(2) as number;
          const start = api.value(3) as number;
          const end = api.value(4) as number;

          const leftBottom = api.coord([start, 0]);
          const rightTop = api.coord([end, yValue]);

          const x = leftBottom[0]!;
          const y = rightTop[1]!;
          const w = rightTop[0]! - leftBottom[0]!;
          const h = leftBottom[1]! - rightTop[1]!;

          void xCenter;
          void width;

          return {
            type: "rect" as const,
            shape: { x, y, width: w, height: h },
            style: {
              fill: "#228be6",
              stroke: "#1864ab",
              lineWidth: 0.5,
            },
            emphasisDisabled: false,
          };
        },
        encode: { x: 0, y: 1, tooltip: [1] },
        data: seriesData,
      },
    ],
  };
}
