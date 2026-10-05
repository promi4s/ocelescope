import type { ViewerConfig, ViewerProps } from "@r4pm/components";

/** One row of a tidy result: a value per column. */
export type Row = Record<string, unknown>;

/** A tidy table: its rows, and the type its source reported per column. */
export interface Table {
  columns: readonly { name: string; type: string }[];
  rows: readonly Row[];
}

/**
 * What every chart is given: rows, and which columns to read them by.
 *
 * Colour and selection follow the r4pm viewer contract: `colorOf` and
 * `onSelect` come from the ambient `ViewerConfig` unless given here.
 */
export interface ChartProps extends Pick<ViewerConfig, "colorOf" | "onSelect"> {
  rows: readonly Row[];
  /** Column whose values name the categories. */
  x: string;
  /** Column, or columns, holding the numbers. */
  y: string | readonly string[];
  /** Column unfolded into one series per distinct value. */
  series?: string;
  /** Scope the marks are coloured and selected under ("activity",
   * "objectType"), so a name keeps the colour the other viewers give it.
   * Without one the plot's own colours are used. */
  colorScope?: string;
}

/** What the charts drawn against two axes take on top of the rest. */
export interface CartesianChartProps extends ChartProps {
  /** Hold the x axis to this range instead of fitting it to the rows - so
   * that several charts share one timeline, or a lone reading does not zoom
   * the axis down to the millisecond around itself. */
  xRange?: readonly [unknown, unknown];
}

export type ChartType =
  | "bar"
  | "histogram"
  | "line"
  | "area"
  | "scatter"
  | "pie"
  | "sunburst";

/** How a table is drawn, when its columns alone should not decide. */
export interface ChartOptions {
  type?: ChartType;
  /** Types offered in the header switch. Fewer than two hides it. */
  types?: ChartType[];
  /** Category column. Defaults to the first non-numeric column. For a
   * histogram, the column holding each bin's lower edge. */
  x?: string;
  /** Histogram only: the column holding each bin's upper edge. */
  xEnd?: string;
  /** Measure column(s). Defaults to every numeric column. */
  y?: string | string[];
  /** Column unfolded into one series per distinct value. */
  series?: string;
  /** Sunburst rings, innermost first. Defaults to `[x, series]`. */
  path?: string[];
  stacked?: boolean;
  horizontal?: boolean;
  /** For line charts, overlay one y scale per line rather than sharing one. */
  yAxes?: "shared" | "independent";
  /** Colour through the host's resolver under this scope ("activity",
   * "objectType"), so a category keeps the colour the graph viewers give it. */
  colorScope?: string;
  title?: string;
  height?: number | string;
}

export type SqlChartProps = ViewerProps<Table> & ChartOptions;

/** One trace's worth of rows: what it is called, and what it draws. */
export interface Series {
  name: string;
  labels: string[];
  /** Numbers where the rows hold numbers, and the text itself where they do
   * not - an attribute reading "in transit" belongs on its own axis, not at
   * zero. Plotly decides the axis from what it is given. */
  values: Array<number | string>;
}

/** How a cell reads once it is a label. */
export const label = (value: unknown) => (value == null ? "∅" : String(value));

/** A cell as the chart plots it: a number where it is one, else its text. */
export const plotted = (value: unknown): number | string => {
  if (typeof value === "number") return value;
  if (value == null || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : String(value);
};

/** The first, or only, column holding numbers. */
export const measureOf = (y: ChartProps["y"]) =>
  (Array.isArray(y) ? y[0] : y) ?? "";
