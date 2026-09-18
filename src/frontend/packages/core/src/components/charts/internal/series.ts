import {
  type ChartProps,
  label,
  measureOf,
  plotted,
  type Series,
} from "../types";

/**
 * The rows as traces: one per value of the `series` column, or one per measure
 * when there is no series column.
 */
export const toSeries = ({
  rows,
  x,
  y,
  series,
}: Pick<ChartProps, "rows" | "x" | "y" | "series">): Series[] => {
  const measures = Array.isArray(y) ? y : [y as string];
  const groups = new Map<string, ChartProps["rows"]>();

  if (series) {
    for (const row of rows) {
      const key = label(row[series]);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  } else {
    for (const measure of measures) groups.set(measure, rows);
  }

  return [...groups].map(([name, group]) => ({
    name,
    labels: group.map((row) => label(row[x])),
    values: group.map((row) => plotted(row[series ? measureOf(y) : name])),
  }));
};

/**
 * What to paint a trace.
 *
 * One trace: the colours tell its categories apart, as in the r4pm activity
 * chart. Several: they tell the traces apart.
 */
export const paint = (
  series: Series,
  colorOf: ChartProps["colorOf"],
  alone: boolean,
) => {
  if (!colorOf) return undefined;
  return alone ? series.labels.map(colorOf) : colorOf(series.name);
};
