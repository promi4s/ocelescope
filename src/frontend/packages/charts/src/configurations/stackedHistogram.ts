import type { EChartsOption } from "echarts";

export interface StackedHistogramDatum {
  x: number;
  series: string;
  value: number;
}

export interface StackedHistogramConfig {
  xAxisName?: string;
  yAxisName?: string;
  seriesName?: string;
}

const COLORS = [
  "#228be6", "#15aabf", "#12b886", "#82c91e", "#fab005",
  "#fd7e14", "#fa5252", "#be4bdb", "#7950f2",
];

export function createStackedHistogramChartOption(
  data: StackedHistogramDatum[],
  config: StackedHistogramConfig = {},
): EChartsOption {
  const seriesNames = Array.from(new Set(data.map((item) => item.series)));
  const totals = new Map<number, number>();
  for (const item of data) {
    totals.set(item.x, (totals.get(item.x) ?? 0) + item.value);
  }
  return {
    animationDuration: 250,
    color: COLORS,
    legend: { type: "scroll", top: 0 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (raw: unknown) => {
        const items = raw as Array<{
          marker?: string;
          seriesName?: string;
          data?: { value: [number, number] };
        }>;
        const visible = items.filter((item) => (item.data?.value[1] ?? 0) > 0);
        const first = visible[0];
        if (!first?.data) return "";
        const x = first.data.value[0];
        const total = totals.get(x) ?? 0;
        return [
          `<strong>${x} object${x === 1 ? "" : "s"} involved</strong>`,
          ...visible.map((item) => {
            const value = item.data?.value[1] ?? 0;
            const percentage = total ? (value / total) * 100 : 0;
            return `${item.marker ?? ""}${item.seriesName ?? ""}: ${value.toLocaleString()} events (${percentage.toFixed(1)}%)`;
          }),
          `<strong>Total: ${total.toLocaleString()} events</strong>`,
        ].join("<br/>");
      },
    },
    grid: { left: 64, right: 24, top: 52, bottom: 72 },
    xAxis: {
      type: "value",
      name: config.xAxisName ?? "Objects involved",
      minInterval: 1,
      min: 0,
    },
    yAxis: {
      type: "value",
      name: config.yAxisName ?? "Events",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e9ecef" } },
    },
    series: seriesNames.map((name) => ({
      name,
      type: "bar",
      stack: config.seriesName ?? "events",
      barMaxWidth: 48,
      data: data
        .filter((item) => item.series === name)
        .map((item) => ({ value: [item.x, item.value] })),
    })),
  };
}
