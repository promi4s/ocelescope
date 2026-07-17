import type { EChartsOption } from "echarts";

import type { StackedBarChartConfig, StackedBarDatum } from "./types";

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
  axisValueLabel?: string;
  data?: { value?: number; total?: number };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createStackedBarChartOption(
  data: StackedBarDatum[],
  config: StackedBarChartConfig = {},
): EChartsOption {
  const categories = Array.from(new Set(data.map((item) => item.category)));
  const seriesNames = Array.from(new Set(data.map((item) => item.series)));
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
        const items = (rawParameters as TooltipItem[]).filter(
          (item) => (item.data?.value ?? item.value ?? 0) > 0,
        );
        const first = items.at(0);
        if (!first) return "";
        const total = first.data?.total ?? 0;
        return [
          `<strong>${escapeHtml(first.axisValueLabel ?? "")}</strong>`,
          ...items.map((item) => {
            const value = item.data?.value ?? item.value ?? 0;
            const percentage = total > 0 ? (value / total) * 100 : 0;
            const unit = config.valueUnit
              ? ` ${value === 1 ? config.valueUnit.singular : config.valueUnit.plural}`
              : "";
            return `${item.marker ?? ""}${escapeHtml(item.seriesName ?? "")}: ${value.toLocaleString()}${escapeHtml(unit)} (${percentage.toFixed(1)}%)`;
          }),
          `<strong>${escapeHtml(valueName)}: ${total.toLocaleString()}</strong>`,
        ].join("<br/>");
      },
    },
    grid: {
      left: 64,
      right: 24,
      top: 52,
      bottom: 82,
    },
    xAxis: {
      type: "category",
      name: config.categoryAxisName,
      data: categories,
      axisLabel: {
        interval: 0,
        rotate: categories.length > (config.rotateLabelsAfter ?? 8) ? 35 : 0,
        width: 100,
        overflow: "truncate",
      },
    },
    yAxis: {
      type: "value",
      name: valueName,
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e9ecef" } },
    },
    series: seriesNames.map((series) => ({
      name: series,
      type: "bar",
      stack: "total",
      barMaxWidth: 54,
      emphasis: { focus: "series" },
      data: categories.map((category) => ({
        value: values.get(`${category}\u0000${series}`) ?? 0,
        total: totals.get(category),
      })),
    })),
  };
}
