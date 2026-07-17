import type { EChartsOption } from "echarts";
import {
  CARTESIAN_GRID,
  datumColor,
  FREQUENCY_TOOLTIP,
  resolveColors,
  VALUE_AXIS,
} from "./shared";
import type { CartesianFrequencyChartConfig, FrequencyDatum } from "./types";

export function createBarChartOption(
  data: FrequencyDatum[],
  config: CartesianFrequencyChartConfig = {},
): EChartsOption {
  const colors = resolveColors(config.colors);
  const seriesName = config.seriesName ?? "Frequency";
  const rotateLabelsAfter = config.rotateLabelsAfter ?? 8;

  return {
    animationDuration: 250,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      ...FREQUENCY_TOOLTIP,
    },
    grid: CARTESIAN_GRID,
    xAxis: {
      type: "category",
      data: data.map((datum) => datum.label),
      axisLabel: {
        interval: 0,
        rotate: data.length > rotateLabelsAfter ? 35 : 0,
        hideOverlap: true,
        width: 90,
        overflow: "truncate",
      },
    },
    yAxis: {
      ...VALUE_AXIS,
      name: config.valueAxisName ?? seriesName,
    },
    series: [
      {
        name: seriesName,
        type: "bar",
        barMaxWidth: 54,
        data: data.map((datum) => ({
          value: datum.value,
          itemStyle: { color: datumColor(datum, colors) },
        })),
      },
    ],
  };
}
