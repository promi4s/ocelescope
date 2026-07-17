import type { EChartsOption } from "echarts";

import type { HierarchyDatum, SunburstChartConfig } from "./types";

const DEFAULT_COLORS = [
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

interface TooltipPathItem {
  name?: string;
  value?: number;
}

interface SunburstTooltipParameters {
  name?: string;
  value?: number;
  treePathInfo?: TooltipPathItem[];
  data?: {
    tooltipValue?: number;
    tooltipValueName?: string;
    tooltipPercentage?: number;
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mapDatum(datum: HierarchyDatum): object {
  return {
    name: datum.label,
    ...(datum.value == null ? {} : { value: datum.value }),
    ...(datum.tooltipValue == null ? {} : { tooltipValue: datum.tooltipValue }),
    ...(datum.tooltipValueName
      ? { tooltipValueName: datum.tooltipValueName }
      : {}),
    ...(datum.tooltipPercentage == null
      ? {}
      : { tooltipPercentage: datum.tooltipPercentage }),
    ...(datum.color ? { itemStyle: { color: datum.color } } : {}),
    ...(datum.children
      ? { children: datum.children.map((child) => mapDatum(child)) }
      : {}),
  };
}

export function createSunburstChartOption(
  data: HierarchyDatum[],
  config: SunburstChartConfig = {},
): EChartsOption {
  const valueName = config.valueName ?? "Frequency";
  return {
    animationDuration: 350,
    color: config.colors ?? DEFAULT_COLORS,
    tooltip: {
      trigger: "item",
      formatter: (rawParameters: unknown) => {
        const parameters = rawParameters as SunburstTooltipParameters;
        const path = (parameters.treePathInfo ?? [])
          .map((item) => item.name)
          .filter((name): name is string => Boolean(name));
        const value = parameters.data?.tooltipValue ?? parameters.value ?? 0;
        const currentValueName = parameters.data?.tooltipValueName ?? valueName;
        const parent = parameters.treePathInfo?.at(-2)?.value;
        const percentage =
          parameters.data?.tooltipPercentage != null
            ? ` (${parameters.data.tooltipPercentage.toFixed(1)}%)`
            : parameters.data?.tooltipValue == null && parent && parent > 0
              ? ` (${((value / parent) * 100).toFixed(1)}%)`
              : "";
        return [
          `<strong>${path.map(escapeHtml).join(" → ")}</strong>`,
          `${escapeHtml(currentValueName)}: ${value.toLocaleString()}${percentage}`,
        ].join("<br/>");
      },
    },
    series: [
      {
        name: config.seriesName ?? valueName,
        type: "sunburst",
        data: data.map((datum) => mapDatum(datum)),
        radius: ["10%", "92%"],
        nodeClick: "rootToNode",
        emphasis: { focus: "ancestor" },
        label: {
          minAngle: 8,
          overflow: "truncate",
        },
        levels: [
          {},
          {
            r0: "10%",
            r: "38%",
            label: { rotate: 0 },
          },
          {
            r0: "38%",
            r: "67%",
          },
          {
            r0: "67%",
            r: "92%",
            label: { position: "outside", padding: 3 },
          },
        ],
      },
    ],
  };
}
