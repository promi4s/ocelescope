import type { EChartsOption } from "echarts";
import { EChartCard } from "../EChartCard";

export interface LineSeries {
  name: string;
  /** Each point as [x, y]. x is a timestamp (ISO string or ms) for xType="time", or a number for xType="value". */
  data: [string | number, number][];
}

export interface LineChartProps {
  title: string;
  series: LineSeries[];
  /** "time" for timestamp x-axis, "value" for numeric. Default: "value". */
  xType?: "time" | "value";
  xLabel?: string;
  yLabel?: string;
  unit?: string;
  smooth?: boolean;
  info?: string;
  height?: number | string;
  filename?: string;
}

export function LineChart({
  title,
  series,
  xType = "value",
  xLabel,
  yLabel,
  unit,
  smooth = false,
  info,
  height = 340,
  filename = "line-chart",
}: LineChartProps) {
  const option: EChartsOption = {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: 36,
      top: series.length > 1 ? 28 : 12,
    },
    legend: series.length > 1 ? { show: true, top: 0 } : undefined,
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const arr = params as Array<{
          seriesName: string;
          data: [string | number, number];
          marker: string;
        }>;
        const x = arr[0]?.data[0];
        const xStr =
          xType === "time" && x != null
            ? new Date(x).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : String(x ?? "");
        const rows = arr
          .map(
            (p) =>
              `${p.marker}${p.seriesName}: <b>${p.data[1].toLocaleString("en-US")}${unit ? ` ${unit}` : ""}</b>`,
          )
          .join("<br/>");
        return `<strong>${xStr}</strong><br/>${rows}`;
      },
    },
    xAxis:
      xType === "time"
        ? {
            type: "time" as const,
            name: xLabel,
            nameLocation: "middle" as const,
            nameGap: 28,
            axisLabel: {
              formatter: {
                year: "{yyyy}",
                month: "{MMM} {yyyy}",
                day: "{d} {MMM}",
                hour: "{d} {MMM} {HH}:{mm}",
                minute: "{HH}:{mm}",
                second: "{HH}:{mm}:{ss}",
                millisecond: "{HH}:{mm}:{ss}",
              },
              hideOverlap: true,
            },
          }
        : {
            type: "value" as const,
            name: xLabel,
            nameLocation: "middle" as const,
            nameGap: 28,
          },
    yAxis: {
      type: "value",
      name: yLabel ?? (unit ? `Value (${unit})` : undefined),
      nameLocation: "middle",
      nameGap: 44,
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.data,
      smooth,
      symbol: "circle",
      symbolSize: 5,
      step: xType === "time" ? ("end" as const) : undefined,
    })),
  };

  return (
    <EChartCard title={title} info={info} filename={filename} height={height} option={option} />
  );
}
