import type { EChartsOption } from "echarts";

import type { BarChartData } from "./types";

export interface BarChartOptions {
  stacked?: boolean;
  horizontal?: boolean;
}

export function barChartOption(
  { categories, series }: BarChartData,
  { stacked = false, horizontal = false }: BarChartOptions = {},
): EChartsOption {
  const rotate = !horizontal && categories.length > 8 ? 35 : 0;

  const categoryAxis = {
    type: "category" as const,
    data: categories,
    axisLabel: { rotate, overflow: "truncate" as const, width: 120 },
    axisTick: { alignWithLabel: true },
  };

  const valueAxis = {
    type: "value" as const,
    name: "Count",
    nameLocation: "middle" as const,
    nameGap: 44,
  };

  return {
    grid: {
      containLabel: true,
      left: 16,
      right: 16,
      bottom: rotate ? 64 : 36,
      top: series.length > 1 ? 32 : 12,
    },
    legend: series.length > 1 ? {} : undefined,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: series.map((s) => ({
      name: s.name,
      type: "bar" as const,
      data: s.data,
      stack: stacked ? "total" : undefined,
    })),
  };
}
