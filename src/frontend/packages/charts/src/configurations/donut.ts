import type { EChartsOption } from "echarts";
import { datumColor, FREQUENCY_TOOLTIP, resolveColors } from "./shared";
import type { FrequencyChartConfig, FrequencyDatum } from "./types";

export function createDonutChartOption(
  data: FrequencyDatum[],
  config: FrequencyChartConfig = {},
): EChartsOption {
  const colors = resolveColors(config.colors);

  return {
    animationDuration: 250,
    tooltip: { trigger: "item", ...FREQUENCY_TOOLTIP },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "middle",
    },
    series: [
      {
        name: config.seriesName ?? "Frequency",
        type: "pie",
        radius: ["44%", "72%"],
        center: ["38%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontWeight: "bold" } },
        data: data.map((datum) => ({
          name: datum.label,
          value: datum.value,
          itemStyle: { color: datumColor(datum, colors) },
        })),
      },
    ],
  };
}
