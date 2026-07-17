import type { EChartsOption } from "echarts";
import {
  CARTESIAN_GRID,
  FREQUENCY_TOOLTIP,
  resolveColors,
  VALUE_AXIS,
} from "./shared";
import type { CartesianFrequencyChartConfig, HistogramData } from "./types";

export function createHistogramChartOption(
  data: HistogramData,
  config: CartesianFrequencyChartConfig = {},
): EChartsOption {
  const colors = resolveColors(config.colors);
  const labels = data.bins.map((bin) => bin.label);
  const values: Array<null | {
    value: number;
    itemStyle: { color: string; borderColor?: string; borderWidth?: number };
  }> = data.bins.map((bin) => ({
    value: bin.value,
    itemStyle: {
      color: colors.primary,
      borderColor: "#fff",
      borderWidth: 0.5,
    },
  }));

  if (data.missing) {
    labels.push("", data.missing.label);
    values.push(null, {
      value: data.missing.value,
      itemStyle: { color: colors.missing },
    });
  }

  return {
    animationDuration: 250,
    tooltip: { trigger: "item", ...FREQUENCY_TOOLTIP },
    grid: CARTESIAN_GRID,
    xAxis: {
      type: "category",
      data: labels,
      axisTick: { alignWithLabel: false },
      axisLabel: {
        rotate: data.bins.length > (config.rotateLabelsAfter ?? 8) ? 35 : 0,
        hideOverlap: true,
        width: 90,
        overflow: "truncate",
      },
    },
    yAxis: {
      ...VALUE_AXIS,
      name: config.valueAxisName ?? "Frequency",
    },
    series: [
      {
        name: config.seriesName ?? "Frequency",
        type: "bar",
        barCategoryGap: "0%",
        barGap: "0%",
        data: values,
      },
    ],
  };
}
