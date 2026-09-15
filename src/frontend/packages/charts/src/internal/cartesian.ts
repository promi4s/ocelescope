import type { EChartsOption } from "echarts";
import type {
  BarChartProps,
  CartesianProps,
  ChartSelection,
  ChartTheme,
  LineChartProps,
  Row,
  ScatterChartProps,
} from "../types";
import { toLabel, toNumber } from "./data";
import type { BuiltChart, ClickParams } from "./engine";
import { baseOption, buildAxis, defaultValueFormat } from "./theme";
import { buildTooltip } from "./tooltip";

/**
 * One builder for every cartesian chart. Bar, line, area and scatter differ by
 * a mark type and a couple of flags, and orientation/stacking/top-N are props -
 * which is why this package has no `horizontalStackedBar` twin of `stackedBar`.
 */

interface Shaped {
  source: Row[];
  columns: string[];
  names: string[];
  members: Row[][];
  pivoted: boolean;
}

const shape = (props: CartesianProps): Shaped => {
  const { rows, x, y, series, sort = "desc", topN } = props;
  const names = series
    ? [...new Set(rows.map((row) => toLabel(row[series])))]
    : [y];
  // Private column keys cannot collide with user categories or series names.
  const columns = names.map((_, index) => `__value_${index}`);
  const groups = new Map<string, Row[]>();
  for (const [index, row] of rows.entries()) {
    const key = series ? toLabel(row[x]) : String(index);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  let members = [...groups.values()];
  const total = (group: Row[]) =>
    group.reduce((sum, row) => sum + toNumber(row[y]), 0);
  if (
    topN != null &&
    Number.isInteger(topN) &&
    topN > 0 &&
    members.length > topN
  ) {
    members.sort((a, b) => total(b) - total(a));
    const tail = members.slice(topN).flat();
    members = [...members.slice(0, topN), tail];
  }
  const source = members.map((group) => {
    const folded = !series
      ? group.length > 1
      : new Set(group.map((row) => toLabel(row[x]))).size > 1;
    const label = folded
      ? `Other (${new Set(group.map((row) => toLabel(row[x]))).size})`
      : group[0]?.[x];
    const row: Row = { __category: label };
    for (const [index, name] of names.entries()) {
      row[columns[index]!] = total(
        series ? group.filter((row) => toLabel(row[series]) === name) : group,
      );
    }
    return row;
  });
  const order = source.map((row, index) => ({ row, members: members[index]! }));
  if (sort !== "none")
    order.sort((a, b) =>
      sort === "category"
        ? toLabel(a.row.__category).localeCompare(toLabel(b.row.__category))
        : (total(a.members) - total(b.members)) * (sort === "asc" ? 1 : -1),
    );
  return {
    source: order.map((item) => item.row),
    members: order.map((item) => item.members),
    columns,
    names,
    pivoted: Boolean(series),
  };
};

export const cartesianOption = (
  props: CartesianProps,
  theme: ChartTheme,
  type: "bar" | "line" | "scatter",
): BuiltChart => {
  const {
    series,
    orientation = "vertical",
    stack = false,
    xAxis = {},
    yAxis = {},
    palette,
    valueFormat = defaultValueFormat,
    tooltip,
    legend,
    itemColor,
    showValues = false,
  } = props;
  const { smooth, step, area } = props as LineChartProps;
  const { barMaxWidth, flush } = props as BarChartProps;
  const { symbolSize } = props as ScatterChartProps;
  const mark = type === "line" && area ? "area" : type;

  const horizontal = orientation === "horizontal";
  const { source, columns, names, members, pivoted } = shape({
    ...props,
    sort: props.sort ?? (type === "bar" ? "desc" : "none"),
  });
  const base = baseOption(theme, palette);

  const categoryAxisSpec = buildAxis(theme, xAxis, "category", {
    categoryCount: source.length,
    horizontal,
    // A horizontal category axis reads top-down unless told otherwise.
    ...(horizontal ? {} : {}),
  });
  const valueAxisSpec = buildAxis(
    theme,
    yAxis,
    "value",
    {},
    yAxis.format ? undefined : valueFormat,
  );

  // ECharts draws a category y-axis bottom-up; inverting keeps the largest bar
  // at the top without reordering the data (which would break click indices).
  const categoryForHorizontal = horizontal
    ? { ...categoryAxisSpec, inverse: xAxis.inverse ?? true }
    : categoryAxisSpec;

  const showLegend = legend ?? Boolean(series && columns.length > 1);

  const seriesType = mark === "area" ? "line" : mark;

  return {
    option: {
      ...base,
      dataset: { source: source as unknown as Record<string, unknown>[] },
      xAxis: horizontal ? valueAxisSpec : categoryForHorizontal,
      yAxis: horizontal ? categoryForHorizontal : valueAxisSpec,
      legend: { ...base.legend, show: showLegend },
      grid: {
        ...base.grid,
        top: showLegend ? 40 : 20,
      },
      tooltip: buildTooltip({
        theme,
        spec: tooltip,
        columns,
        defaultTrigger: mark === "scatter" ? "item" : "axis",
        valueFormat,
      }),
      series: columns.map((column, seriesIndex) => ({
        type: seriesType as "bar" | "line" | "scatter",
        ...(pivoted ? { name: names[seriesIndex] } : {}),
        ...(stack ? { stack: "total" } : {}),
        ...(mark === "bar"
          ? flush
            ? {
                // A histogram's bars have to touch, so the default width cap
                // must not apply: it would leave a gap whenever a category slot
                // is wider than the cap. Only an explicit width is honoured.
                barCategoryGap: "0%",
                barGap: "0%",
                ...(barMaxWidth != null ? { barMaxWidth } : {}),
              }
            : { barMaxWidth: barMaxWidth ?? 48 }
          : {}),
        ...(mark === "line" || mark === "area"
          ? {
              smooth: smooth ?? false,
              ...(step ? { step: "middle" as const } : {}),
              showSymbol: source.length <= 60,
              symbolSize: symbolSize ?? 6,
            }
          : {}),
        ...(mark === "area"
          ? { areaStyle: { opacity: stack ? 0.7 : 0.15 } }
          : {}),
        ...(mark === "scatter" ? { symbolSize: symbolSize ?? 10 } : {}),
        ...(showValues
          ? {
              label: {
                show: true,
                position: horizontal ? "right" : "top",
                color: theme.text,
                formatter: ({ value }: { value: unknown }) => {
                  const row = value as Row | undefined;
                  return row ? valueFormat(toNumber(row[column])) : "";
                },
              },
            }
          : {}),
        ...(itemColor && !pivoted
          ? {
              itemStyle: {
                color: ({ dataIndex }: { dataIndex: number }) =>
                  itemColor(members[dataIndex]?.[0] ?? {}) ??
                  theme.palette[0] ??
                  "#228be6",
              },
            }
          : {}),
        encode: horizontal
          ? { x: column, y: "__category" }
          : { x: "__category", y: column },
        emphasis: { focus: "series" as const },
      })) as EChartsOption["series"],
    },
    select: (params: ClickParams): ChartSelection | undefined => {
      const index = params.dataIndex ?? -1;
      const row = source[index];
      const seriesIndex = params.seriesIndex ?? 0;
      const column = columns[seriesIndex];
      if (!row || !column) return undefined;
      const name = names[seriesIndex];
      const originals = (members[index] ?? []).filter(
        (item) => !series || toLabel(item[series]) === name,
      );
      if (!originals.length) return undefined;
      return {
        row: originals[0]!,
        rows: originals,
        category: toLabel(row.__category),
        ...(pivoted && name != null ? { series: name } : {}),
        value: toNumber(row[column]),
      };
    },
  };
};
