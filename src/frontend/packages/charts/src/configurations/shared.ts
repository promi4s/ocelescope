import type { FrequencyChartColors, FrequencyDatum } from "./types";

export const DEFAULT_FREQUENCY_CHART_COLORS: FrequencyChartColors = {
  primary: "#228be6",
  missing: "#adb5bd",
  other: "#868e96",
};

export const CARTESIAN_GRID = {
  left: 56,
  right: 20,
  top: 20,
  bottom: 72,
  containLabel: false,
} as const;

export const VALUE_AXIS = {
  type: "value" as const,
  minInterval: 1,
  splitLine: { lineStyle: { color: "#e9ecef" } },
};

export const FREQUENCY_TOOLTIP = {
  valueFormatter: (value: unknown) =>
    typeof value === "number" ? value.toLocaleString() : String(value),
};

export function resolveColors(
  colors?: Partial<FrequencyChartColors>,
): FrequencyChartColors {
  return { ...DEFAULT_FREQUENCY_CHART_COLORS, ...colors };
}

export function datumColor(
  datum: FrequencyDatum,
  colors: FrequencyChartColors,
) {
  if (datum.kind === "missing") return colors.missing;
  if (datum.kind === "other") return colors.other;
  return colors.primary;
}
