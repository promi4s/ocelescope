/**
 * Chart types. Shared by every chart that uses the generic
 * interactivity layer in `EChartCard`.
 */

export interface NumericRange {
  min: number;
  max: number;
}

export interface ChartViewport {
  x?: NumericRange;
  y?: NumericRange;
}

export interface ChartPoint {
  /** Index into the series data array that was clicked. */
  dataIndex: number;
  /** The clicked value — shape depends on the series type. */
  value: unknown;
  /** The series the clicked point belongs to (only present for named series). */
  seriesName?: string;
}

export interface ZoomConfig {
  /** Which axis (or axes) the zoom should bind to. Defaults to `"x"`. */
  axis?: "x" | "y" | "xy";
  /** Show the slider bar below the chart. Defaults to `true`. */
  slider?: boolean;
  /** Enable drag / scroll / pinch on the chart canvas itself. Defaults to `true`. */
  mouse?: boolean;
}

export interface BrushConfig {
  /** Which axis the line brush selects across. */
  axis: "x" | "y";
}

export type ChartEventHandler = (...args: unknown[]) => void;
export type ChartEventMap = Record<string, ChartEventHandler>;

export type ChartExportFormat = "png" | "svg";
