import type { EChartsOption } from "echarts";

export interface ObjectAttributeTimelinePoint {
  label: string;
  activity?: string;
}

export type ObjectAttributeTimelineValue = string | number | boolean | null;

export interface ObjectAttributeTimelineConfig {
  colors?: string[];
}

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

// How many attributes get a real, labeled axis on each side before we stop drawing
// axis lines/labels for the rest (their series and legend entry still work, they just
// don't claim more horizontal margin -- otherwise 10+ attributes would blow up the
// chart's width).
const MAX_LABELED_AXES_PER_SIDE = 3;
const AXIS_OFFSET_STEP = 64;
const BASE_MARGIN = 56;

function formatValue(value: ObjectAttributeTimelineValue) {
  if (value === null) return "—";
  return String(value);
}

function isNumericLike(value: ObjectAttributeTimelineValue): boolean {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  return value.trim() !== "" && Number.isFinite(Number(value));
}

// ECharts line series only accept numeric/null data points; booleans and
// numeric-looking strings are coerced for plotting, the raw value is still what the
// tooltip shows.
function toPlotValue(value: ObjectAttributeTimelineValue): number | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Attributes whose values aren't (all) numeric -- strings, dates -- get a category
// y-axis instead, so their changes are still visible as a plotted line rather than a
// blank/omitted series. Dates sort chronologically; everything else alphabetically.
function buildCategoryAxis(values: ObjectAttributeTimelineValue[]) {
  const distinct = Array.from(
    new Set(
      values.filter((value): value is string => typeof value === "string"),
    ),
  );
  const allDates = distinct.every((value) => !Number.isNaN(Date.parse(value)));
  distinct.sort((a, b) =>
    allDates ? Date.parse(a) - Date.parse(b) : a.localeCompare(b),
  );
  const indexOf = new Map(distinct.map((value, index) => [value, index]));
  return {
    categories: distinct,
    toIndex: (value: ObjectAttributeTimelineValue): number | null =>
      typeof value === "string" ? (indexOf.get(value) ?? null) : null,
  };
}

/**
 * Every attribute plotted as a colored line sharing one x-axis and one plot area --
 * each attribute keeps its own y-axis (own scale/unit), overlaid rather than stacked
 * into separate panels, so the chart's height no longer grows with attribute count.
 * Axes alternate left/right and are color-matched to their series; once
 * MAX_LABELED_AXES_PER_SIDE is exceeded per side, further axes stay functional
 * (series + tooltip + legend) but stop drawing a visible line/label to avoid
 * unbounded margin growth.
 */
export function createObjectAttributeTimelineChartOption(
  points: ObjectAttributeTimelinePoint[],
  series: Record<string, ObjectAttributeTimelineValue[]>,
  config: ObjectAttributeTimelineConfig = {},
): EChartsOption {
  const attributes = Object.keys(series);
  const colors = config.colors ?? DEFAULT_COLORS;
  const categories = points.map((point) => point.label);

  const axes = attributes.map((attribute) => {
    const values = series[attribute] ?? [];
    if (values.every(isNumericLike)) {
      return { kind: "numeric" as const };
    }
    return { kind: "categorical" as const, ...buildCategoryAxis(values) };
  });

  let leftSeen = 0;
  let rightSeen = 0;
  const placements = attributes.map((_, index) => {
    const side: "left" | "right" = index % 2 === 0 ? "left" : "right";
    const slot = side === "left" ? leftSeen++ : rightSeen++;
    return {
      side,
      slot,
      labeled: slot < MAX_LABELED_AXES_PER_SIDE,
    };
  });

  const marginFor = (side: "left" | "right") => {
    const labeledOnSide = Math.min(
      placements.filter((p) => p.side === side).length,
      MAX_LABELED_AXES_PER_SIDE,
    );
    return labeledOnSide === 0
      ? 16
      : BASE_MARGIN + AXIS_OFFSET_STEP * (labeledOnSide - 1);
  };

  return {
    animationDuration: 250,
    color: colors,
    legend: {
      type: "scroll",
      top: 0,
      textStyle: { fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      formatter: (raw: unknown) => {
        const items = raw as Array<{
          marker?: string;
          seriesName?: string;
          dataIndex: number;
        }>;
        const first = items[0];
        if (!first) return "";
        const point = points[first.dataIndex];
        const lines = [
          point?.activity
            ? `<strong>${point.activity}</strong>`
            : "<strong>Attribute change</strong>",
          ...items.map(
            (item) =>
              `${item.marker ?? ""}${item.seriesName ?? ""}: ${formatValue(
                series[item.seriesName ?? ""]?.[item.dataIndex] ?? null,
              )}`,
          ),
        ];
        return lines.join("<br/>");
      },
    },
    grid: {
      top: 44,
      bottom: 60,
      left: marginFor("left"),
      right: marginFor("right"),
    },
    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: false,
      axisLabel: {
        interval: "auto",
        rotate: 35,
        overflow: "truncate",
        width: 90,
      },
    },
    yAxis: attributes.map((attribute, index) => {
      const axis = axes[index] ?? { kind: "numeric" as const };
      const placement = placements[index] ?? {
        side: "left" as const,
        slot: 0,
        labeled: true,
      };
      const color = colors[index % colors.length];
      return {
        type: axis.kind === "categorical" ? "category" : "value",
        position: placement.side,
        offset: placement.labeled ? placement.slot * AXIS_OFFSET_STEP : 0,
        name: placement.labeled ? attribute : undefined,
        nameLocation: "middle",
        nameGap: axis.kind === "categorical" ? 60 : 40,
        nameTextStyle: { color },
        data: axis.kind === "categorical" ? axis.categories : undefined,
        show: placement.labeled,
        axisLine: { show: placement.labeled, lineStyle: { color } },
        axisTick: { show: placement.labeled },
        axisLabel: { show: placement.labeled, color },
        splitLine: { show: index === 0, lineStyle: { color: "#e9ecef" } },
      };
    }),
    series: attributes.map((attribute, index) => {
      const axis = axes[index] ?? { kind: "numeric" as const };
      const values = series[attribute] ?? [];
      return {
        name: attribute,
        type: "line",
        step: "end",
        yAxisIndex: index,
        showSymbol: points.length <= 60,
        symbolSize: 6,
        data:
          axis.kind === "categorical"
            ? values.map(axis.toIndex)
            : values.map(toPlotValue),
      };
    }),
  };
}
