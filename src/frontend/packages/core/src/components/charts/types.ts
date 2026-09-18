/** One row of a tidy result: a value per column. */
export type Row = Record<string, unknown>;

/** What every chart is given: rows, and which columns to read them by. */
export interface ChartProps {
  rows: readonly Row[];
  /** Column whose values name the categories. */
  x: string;
  /** Column, or columns, holding the numbers. */
  y: string | readonly string[];
  /** Column unfolded into one series per distinct value. */
  series?: string;
  /** Colour for a name, e.g. the one the graph viewers give it. */
  colorOf?: (name: string) => string;
  /** A click on a mark, by the name that mark carries. */
  onSelect?: (name: string, point: unknown) => void;
}

/** What the charts drawn against two axes take on top of the rest. */
export interface CartesianChartProps extends ChartProps {
  /** Hold the x axis to this range instead of fitting it to the rows - so
   * that several charts share one timeline, or a lone reading does not zoom
   * the axis down to the millisecond around itself. */
  xRange?: readonly [unknown, unknown];
}

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
