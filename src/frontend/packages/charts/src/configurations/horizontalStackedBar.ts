import type { EChartsOption } from "echarts";

import type { HorizontalStackedBarChartConfig, StackedBarDatum } from "./types";

const DEFAULT_SERIES_COLORS = [
  "#228be6",
  "#15aabf",
  "#12b886",
  "#82c91e",
  "#fab005",
  "#fd7e14",
  "#fa5252",
  "#be4bdb",
  "#7950f2",
];

interface TooltipItem {
  marker?: string;
  seriesName?: string;
  value?: number;
  data?: {
    value?: number;
    fullCategory?: string;
    total?: number;
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createHorizontalStackedBarChartOption(
  data: StackedBarDatum[],
  config: HorizontalStackedBarChartConfig = {},
): EChartsOption {
  const categories = Array.from(new Set(data.map((item) => item.category)));
  const seriesNames = Array.from(new Set(data.map((item) => item.series)));
  const fullLabels = new Map(
    data.map((item) => [item.category, item.fullCategory ?? item.category]),
  );
  const values = new Map(
    data.map((item) => [`${item.category}\u0000${item.series}`, item.value]),
  );
  const totals = new Map(
    categories.map((category) => [
      category,
      seriesNames.reduce(
        (sum, series) => sum + (values.get(`${category}\u0000${series}`) ?? 0),
        0,
      ),
    ]),
  );
  const valueName = config.valueName ?? "Frequency";

  return {
    animationDuration: 250,
    color: config.colors ?? DEFAULT_SERIES_COLORS,
    legend: {
      show: seriesNames.length > 1,
      type: "scroll",
      top: 0,
      selectedMode: config.interactiveLegend ?? true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (rawParameters: unknown) => {
        const items = rawParameters as TooltipItem[];
        const visible = items.filter(
          (item) => (item.data?.value ?? item.value ?? 0) > 0,
        );
        const first = visible.at(0);
        if (!first) return "";
        const category = first.data?.fullCategory ?? categories[0] ?? "";
        const total = first.data?.total ?? 0;
        return [
          `<strong>${escapeHtml(category)}</strong>`,
          ...visible.map((item) => {
            const value = item.data?.value ?? item.value ?? 0;
            const denominator = config.percentageTotal ?? total;
            const percentage =
              denominator > 0 ? (value / denominator) * 100 : 0;
            return `${item.marker ?? ""}${escapeHtml(item.seriesName ?? "")}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;
          }),
          `<strong>${escapeHtml(valueName)}: ${total.toLocaleString()}</strong>`,
        ].join("<br/>");
      },
    },
    grid: {
      left: 150,
      right: 24,
      top: 52,
      bottom: 24,
      containLabel: false,
    },
    xAxis: {
      type: "value",
      name: valueName,
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e9ecef" } },
    },
    yAxis: {
      type: "category",
      name: config.categoryAxisName,
      data: categories,
      inverse: true,
      axisLabel: {
        width: 132,
        overflow: "truncate",
      },
    },
    series: seriesNames.map((series) => ({
      name: series,
      type: "bar",
      stack: "total",
      barMaxWidth: 36,
      emphasis: { focus: "series" },
      data: categories.map((category) => ({
        value: values.get(`${category}\u0000${series}`) ?? 0,
        fullCategory: fullLabels.get(category),
        total: totals.get(category),
      })),
    })),
  };
}
