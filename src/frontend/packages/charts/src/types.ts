import type { ReactNode } from "react";

/** A cell in a tidy row. Deliberately narrow: whatever JSON an API returns. */
export type Primitive = string | number | boolean | null | undefined;

/** One observation; charts read the columns named by their props. */
export type Row = Record<string, Primitive>;

/** Column name. Aliased for readability in chart props. */
export type Column = string;

export type AxisKind = "category" | "value" | "time" | "log";

export interface AxisSpec {
  /** Axis title. */
  name?: string;
  /** Defaults to "category" for the category axis and "value" for the other. */
  type?: AxisKind;
  /** Formats tick labels. Also used for the axis pointer. */
  format?: (value: string | number) => string;
  min?: number | "dataMin";
  max?: number | "dataMax";
  /** Force integer ticks. Counts should pass 1. */
  minInterval?: number;
  /**
   * Rotate category labels once there are more than `n` of them.
   * `false` never rotates.
   */
  rotateLabelsAfter?: number | false;
  /** Truncate labels wider than this (px). */
  maxLabelWidth?: number;
  /** Draw the axis from the far end (top-down for a horizontal bar chart). */
  inverse?: boolean;
}

export type ValueFormatter = (value: number) => string;

export interface TooltipSpec {
  trigger?: "axis" | "item" | "none";
  /** Append a total row. Only meaningful for stacked/multi-series charts. */
  showTotal?: boolean;
  /**
   * Show each value as a share. `true` divides by the stack total of the
   * hovered category; a number divides by that fixed denominator instead.
   */
  showPercent?: boolean | number;
  /** Hide series whose value is zero. Keeps wide stacks readable. */
  hideZero?: boolean;
  /** Formats values in the tooltip body. Defaults to the chart's `valueFormat`. */
  format?: ValueFormatter;
  /** Label for the total row. */
  totalLabel?: string;
}

export interface BaseChartProps {
  /** Tidy rows. The only data input any chart accepts. */
  rows: Row[];
  /** Chart height. Charts never size themselves by content. */
  height?: number | string;
  loading?: boolean;
  /** Shown instead of the canvas when there is nothing to draw. */
  emptyMessage?: ReactNode;
  /** Overrides the automatic "no rows" check, e.g. when a total is 0. */
  empty?: boolean;
  /** Series colours. Defaults to the themed palette. */
  palette?: string[];
  /** Receives the data behind the clicked mark, never an ECharts event. */
  onSelect?: (selection: ChartSelection) => void;
}

/** A renderer-independent mark selection. `row` is the first original row;
 * use `rows` for aggregated marks and `path` for hierarchy navigation. */
export interface ChartSelection {
  row: Row;
  /** Original observations represented by this mark, including folded categories. */
  rows: Row[];
  /** Full hierarchy path, when selecting a hierarchical mark. */
  path?: string[];
  /** Category the mark belongs to, i.e. the value of the `x` column. */
  category: string;
  /** Series name, when the chart splits one column into several series. */
  series?: string;
  value: Primitive;
}

/**
 * Concrete colours, never CSS custom properties: ECharts draws to canvas/SVG
 * and cannot resolve `var(--mantine-color-text)`, which silently renders black.
 */
export interface ChartTheme {
  palette: string[];
  text: string;
  dimmed: string;
  grid: string;
  background: string;
  tooltipBackground: string;
  tooltipBorder: string;
  fontFamily: string;
  /** Semantic colours for rows a chart singles out. */
  missing: string;
  other: string;
}

export interface NumericRange {
  min: number;
  max: number;
}

/** Visible extent expressed as percentages (0–100) on each axis. */
export interface ChartViewport {
  x?: NumericRange;
  y?: NumericRange;
}

export interface ZoomConfig {
  /** Which axis (or axes) the zoom binds to. Defaults to `"x"`. */
  axis?: "x" | "y" | "xy";
  /** Show the slider bar below the chart. Defaults to `true`. */
  slider?: boolean;
  /** Enable drag / scroll / pinch on the canvas itself. Defaults to `true`. */
  mouse?: boolean;
}

export interface BrushConfig {
  /** Which axis the line brush selects across. */
  axis: "x" | "y";
}

export type ChartExportFormat = "png" | "svg";

export type SortDirection = "asc" | "desc" | "none";

export interface CartesianProps extends BaseChartProps {
  valueFormat?: ValueFormatter;
  tooltip?: TooltipSpec | false;
  legend?: boolean;
  /** Column on the category axis. */
  x: Column;
  /** Numeric column on the value axis. */
  y: Column;
  /**
   * Column unfolded into one series per distinct value. Turns a flat chart into
   * a grouped, stacked or multi-line one without changing the data contract.
   */
  series?: Column;
  orientation?: "vertical" | "horizontal";
  stack?: boolean;
  /** Sort by value (default), by category label, or leave the row order alone. */
  sort?: SortDirection | "category";
  /** Keep the n biggest categories, folding the rest into one "Other". */
  topN?: number;
  xAxis?: AxisSpec;
  yAxis?: AxisSpec;
  /** Per-mark colour, e.g. to grey out "missing" and "other" buckets. */
  itemColor?: (row: Row) => string | undefined;
  /** Print the value next to each mark. */
  showValues?: boolean;
}

export interface BarChartProps extends CartesianProps {
  /** Bars sit flush against each other, as in a histogram. */
  flush?: boolean;
  barMaxWidth?: number;
}

export interface LineChartProps extends CartesianProps {
  /** Fill the area under the line. */
  area?: boolean;
  smooth?: boolean;
  /** Step line, for values that hold until the next observation. */
  step?: boolean;
  symbolSize?: number;
}

export interface ScatterChartProps extends CartesianProps {
  symbolSize?: number;
}

export interface PieChartProps extends BaseChartProps {
  valueFormat?: ValueFormatter;
  tooltip?: TooltipSpec | false;
  legend?: boolean;
  /** Column holding the slice label. */
  name: Column;
  /** Numeric column holding the slice size. */
  value: Column;
  /** Cut out the middle. A donut is easier to compare than a full pie. */
  donut?: boolean;
  /** Show labels on the slices instead of only on hover. */
  showLabels?: boolean;
  sort?: SortDirection;
  /** Per-slice colour, e.g. to grey out "missing" and "other" buckets. */
  itemColor?: (row: Row) => string | undefined;
  /** Fold small slices into one, so the legend stays readable. */
  topN?: number;
}

export interface SunburstProps extends BaseChartProps {
  valueFormat?: ValueFormatter;
  /**
   * Columns read outside-in, one ring per column. Tidy rows keep their shape:
   * the tree is folded here rather than in the feature module.
   */
  path: Column[];
  /** Numeric column summed up the tree. */
  value: Column;
  /**
   * Per ring, aligned with `path`: a column holding the authoritative value for
   * nodes on that ring, or `null` where the sum of the children is correct.
   * Used for the reported number and as the denominator for the next ring.
   *
   * Ring *area* is always the sum, because that is what the geometry shows.
   * This exists for hierarchies whose children overlap - an event involving
   * both an order and an item is one event but two object-type children, so
   * summing those children would over-report it.
   */
  nodeValue?: Array<Column | null>;
  /** Depth at which labels stop being drawn. */
  labelDepth?: number;
  /** Fold nodes contributing less than this share of their parent (0 to 1). */
  minShare?: number;
}

export interface TimelineChartProps extends BaseChartProps {
  legend?: boolean;
  tooltip?: false;
  x: Column;
  values: Column[];
}
/** Axis interactions are available only on charts with Cartesian axes. */
export interface AxisInteractions {
  zoom?: ZoomConfig;
  brush?: BrushConfig;
  viewport?: ChartViewport | null;
  onViewportChange?: (viewport: ChartViewport | null) => void;
  onSelection?: (selection: ChartViewport | null) => void;
}

/** Only settings applicable to the selected chart type are accepted. */
export type ChartProps =
  | ({ type: "bar" } & BarChartProps & AxisInteractions)
  | ({ type: "line" } & LineChartProps & AxisInteractions)
  | ({ type: "scatter" } & ScatterChartProps & AxisInteractions)
  | ({ type: "pie" } & PieChartProps)
  | ({ type: "sunburst" } & SunburstProps)
  | ({ type: "timeline" } & TimelineChartProps & AxisInteractions);
