import { useComputedColorScheme, useMantineTheme } from "@mantine/core";
import { useMemo } from "react";
import type { AxisSpec, ChartTheme, ValueFormatter } from "../types";

/**
 * ECharts draws to canvas/SVG and cannot resolve CSS custom properties:
 * `var(--mantine-color-text)` silently renders black. Every colour a chart uses
 * has to be a concrete value, so this hook is the single place that knows what
 * Ocelescope looks like - and the only reason charts follow the colour scheme.
 */

/** Qualitative palette. Ordered so neighbouring series stay distinguishable. */
const PALETTE_KEYS = [
  "blue",
  "teal",
  "grape",
  "orange",
  "cyan",
  "lime",
  "violet",
  "pink",
  "yellow",
  "red",
] as const;

const FALLBACK_PALETTE = [
  "#228be6",
  "#12b886",
  "#be4bdb",
  "#fd7e14",
  "#15aabf",
  "#82c91e",
  "#7950f2",
  "#e64980",
  "#fab005",
  "#fa5252",
];

export const useChartTheme = (): ChartTheme => {
  const theme = useMantineTheme();
  const scheme = useComputedColorScheme("light");

  return useMemo(() => {
    const dark = scheme === "dark";
    // Lighter shades read better on a dark ground, deeper ones on a light one.
    const shade = dark ? 4 : 6;
    const gray = theme.colors.gray ?? [];
    const darkScale = theme.colors.dark ?? [];

    const palette = PALETTE_KEYS.map(
      (key, index) =>
        theme.colors[key]?.[shade] ??
        FALLBACK_PALETTE[index] ??
        FALLBACK_PALETTE[0] ??
        "#228be6",
    );

    return {
      palette,
      text: dark ? (gray[3] ?? "#ced4da") : (gray[8] ?? "#343a40"),
      dimmed: gray[6] ?? "#868e96",
      grid: dark ? (darkScale[4] ?? "#4d4f66") : (gray[2] ?? "#e9ecef"),
      background: dark ? (darkScale[7] ?? "#1a1b1e") : "#ffffff",
      tooltipBackground: dark ? (darkScale[6] ?? "#25262b") : "#ffffff",
      tooltipBorder: dark
        ? (darkScale[4] ?? "#4d4f66")
        : (gray[3] ?? "#dee2e6"),
      fontFamily: theme.fontFamily,
      missing: gray[dark ? 6 : 5] ?? "#adb5bd",
      other: gray[dark ? 5 : 6] ?? "#868e96",
    };
  }, [theme, scheme]);
};

/** Default number formatting: grouped thousands, no forced decimals. */
export const defaultValueFormat: ValueFormatter = (value) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

/* -------------------------------------------------------------------------- */
/* Axis and chrome primitives shared by every option builder                  */
/* -------------------------------------------------------------------------- */

const ROTATE_LABELS_AFTER = 8;

export interface AxisContext {
  /** Number of categories, used to decide whether labels need rotating. */
  categoryCount?: number;
  /** Horizontal axes never rotate their labels. */
  horizontal?: boolean;
}

export const categoryAxis = (
  theme: ChartTheme,
  spec: AxisSpec = {},
  context: AxisContext = {},
) => {
  const threshold =
    spec.rotateLabelsAfter === false
      ? Number.POSITIVE_INFINITY
      : (spec.rotateLabelsAfter ?? ROTATE_LABELS_AFTER);
  const rotate =
    !context.horizontal && (context.categoryCount ?? 0) > threshold ? 35 : 0;

  return {
    type: "category" as const,
    ...(spec.name ? { name: spec.name, nameGap: 34 } : {}),
    nameLocation: "middle" as const,
    nameTextStyle: { color: theme.dimmed },
    ...(spec.inverse ? { inverse: true } : {}),
    axisLabel: {
      color: theme.dimmed,
      hideOverlap: true,
      interval: 0 as const,
      rotate,
      width: spec.maxLabelWidth ?? (context.horizontal ? 140 : 96),
      overflow: "truncate" as const,
      ...(spec.format ? { formatter: spec.format } : {}),
    },
    axisLine: { lineStyle: { color: theme.grid } },
    axisTick: { show: false },
  };
};

export const valueAxis = (
  theme: ChartTheme,
  spec: AxisSpec = {},
  format: ValueFormatter = defaultValueFormat,
) => ({
  type: (spec.type === "log" ? "log" : "value") as "value" | "log",
  ...(spec.name ? { name: spec.name, nameGap: 46 } : {}),
  nameLocation: "middle" as const,
  nameTextStyle: { color: theme.dimmed },
  ...(spec.min != null ? { min: spec.min } : {}),
  ...(spec.max != null ? { max: spec.max } : {}),
  ...(spec.minInterval != null ? { minInterval: spec.minInterval } : {}),
  axisLabel: {
    color: theme.dimmed,
    formatter: (value: number) => (spec.format ?? format)(value),
  },
  splitLine: { lineStyle: { color: theme.grid } },
});

/** Time axis, for rows carrying ISO timestamps. */
export const timeAxis = (theme: ChartTheme, spec: AxisSpec = {}) => ({
  type: "time" as const,
  ...(spec.name ? { name: spec.name, nameGap: 34 } : {}),
  nameLocation: "middle" as const,
  nameTextStyle: { color: theme.dimmed },
  axisLabel: {
    color: theme.dimmed,
    hideOverlap: true,
    ...(spec.format ? { formatter: spec.format } : {}),
  },
  axisLine: { lineStyle: { color: theme.grid } },
  splitLine: { show: false },
});

/** Picks the right axis factory for a spec. */
export const buildAxis = (
  theme: ChartTheme,
  spec: AxisSpec,
  fallback: "category" | "value",
  context: AxisContext = {},
  format?: ValueFormatter,
) => {
  const kind = spec.type ?? fallback;
  if (kind === "time") return timeAxis(theme, spec);
  if (kind === "category") return categoryAxis(theme, spec, context);
  return valueAxis(theme, spec, format);
};

export const baseGrid = { left: 12, right: 20, top: 40, bottom: 12 } as const;

/** Chrome every chart shares: colours, fonts, grid, legend. */
export const baseOption = (theme: ChartTheme, palette?: string[]) => ({
  color: palette ?? theme.palette,
  animationDuration: 250,
  textStyle: { fontFamily: theme.fontFamily, color: theme.text },
  aria: { enabled: true },
  grid: { ...baseGrid, containLabel: true },
  legend: {
    type: "scroll" as const,
    top: 0,
    textStyle: { color: theme.text },
    inactiveColor: theme.dimmed,
  },
});
