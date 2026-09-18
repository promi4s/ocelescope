import type { SqlQueryResult } from "@ocelescope/api-base";
import type { ViewerConfig, ViewerProps } from "@r4pm/components";
import dynamic from "next/dynamic";
import type { AreaChartProps } from "./AreaChart";
import type { BarChartProps } from "./BarChart";
import type { LineChartProps } from "./LineChart";
import type { PieChartProps } from "./PieChart";
import type { ScatterChartProps } from "./ScatterChart";
import type { SunburstChartProps } from "./SunburstChart";

/**
 * Charts of the current OCEL, written as SQL.
 *
 * Two layers, so that either can be used on its own: a chart per kind - handed
 * rows and told which columns to read - and `SqlChart` / `OcelChart`, which
 * run a query and hand its result to one of them.
 *
 * ```tsx
 * <OcelChart
 *   title="Events per activity"
 *   colorScope="activity"
 *   sql={`SELECT "ocel:activity" AS activity, count(*) AS events
 *         FROM events GROUP BY 1 ORDER BY 2 DESC`}
 * />
 * ```
 *
 * The charts are r4pm viewers: colours and selection come from the ambient
 * `ViewerConfig`, the plot is a `ThemedPlot`, so it hovers, zooms and toggles
 * its legend like every other r4pm chart, and an enclosing
 * `<ViewerExportFrame>` exports it along with everything else in the frame.
 */

export type { AreaChartProps } from "./AreaChart";
export type { BarChartProps } from "./BarChart";
export type { LineChartProps } from "./LineChart";
export type { PieChartProps } from "./PieChart";
export type { ScatterChartProps } from "./ScatterChart";
export type { SunburstChartProps } from "./SunburstChart";
export type {
  CartesianChartProps,
  ChartProps,
  Row,
  Series,
} from "./types";

export type ChartType =
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie"
  | "sunburst";

/** How a query's result is drawn, when the columns alone should not decide. */
export interface ChartOptions {
  type?: ChartType;
  /** Types offered in the header switch. Fewer than two hides it. */
  types?: ChartType[];
  /** Category column. Defaults to the first non-numeric column. */
  x?: string;
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

export type SqlChartProps = ViewerProps<SqlQueryResult> & ChartOptions;

export interface OcelChartProps extends ChartOptions, ViewerConfig {
  /** DuckDB SQL over the OCEL's stored tables: `events`, `objects`, `e2o`,
   * `o2o`, `object_changes`. One `SELECT`; the backend refuses anything else. */
  sql: string;
  /** Values bound to the query's `?` placeholders. Bind them here rather than
   * building the SQL by hand. */
  parameters?: unknown[];
  /** Defaults to the filtered log, which is what the rest of the app shows. */
  ocelVersion?: "filtered" | "original";
  /** Hold the query back, e.g. until the user has picked an activity. */
  enabled?: boolean;
}

// Plotly reads `document` while it loads, so every chart is browser-only - the
// same boundary the other r4pm viewers are mounted behind.
const browserOnly = <Props,>(load: () => Promise<React.ComponentType<Props>>) =>
  dynamic<Props>(load, { ssr: false });

export const BarChart = browserOnly<BarChartProps>(() =>
  import("./BarChart").then((module) => module.BarChart),
);

export const LineChart = browserOnly<LineChartProps>(() =>
  import("./LineChart").then((module) => module.LineChart),
);

export const AreaChart = browserOnly<AreaChartProps>(() =>
  import("./AreaChart").then((module) => module.AreaChart),
);

export const ScatterChart = browserOnly<ScatterChartProps>(() =>
  import("./ScatterChart").then((module) => module.ScatterChart),
);

export const PieChart = browserOnly<PieChartProps>(() =>
  import("./PieChart").then((module) => module.PieChart),
);

export const SunburstChart = browserOnly<SunburstChartProps>(() =>
  import("./SunburstChart").then((module) => module.SunburstChart),
);

export const SqlChart = browserOnly<SqlChartProps>(() =>
  import("./SqlChart").then((module) => module.SqlChart),
);

export const OcelChart = browserOnly<OcelChartProps>(() =>
  import("./OcelChart").then((module) => module.OcelChart),
);
