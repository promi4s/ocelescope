import type { ChartProps } from "../types";
import type { Trace } from "./Plot";
import { paint, toSeries } from "./series";

/**
 * Traces for the charts drawn against two axes.
 *
 * Bars, lines, areas and points differ by a handful of Plotly fields and
 * nothing else, so they share the shape of their traces and each chart says
 * what makes it itself.
 */
export const cartesian = (
  { rows, x, y, series, colorOf }: ChartProps,
  mark: Trace,
  horizontal = false,
  colorByPoint = true,
): Trace[] => {
  const groups = toSeries({ rows, x, y, series });

  return groups.map((group) => {
    const color = paint(group, colorOf, colorByPoint && groups.length === 1);
    const line = (mark.line ?? {}) as Record<string, unknown>;
    const marker = (mark.marker ?? {}) as Record<string, unknown>;
    return {
      ...mark,
      name: group.name,
      orientation: horizontal ? "h" : "v",
      x: horizontal ? group.values : group.labels,
      y: horizontal ? group.labels : group.values,
      marker: { ...marker, ...(color && { color }) },
      ...(typeof color === "string" && mark.line
        ? { line: { ...line, color } }
        : {}),
    };
  });
};

/** How many traces a chart will draw, which decides whether it needs a legend. */
export const traceCount = (props: ChartProps) => toSeries(props).length;
