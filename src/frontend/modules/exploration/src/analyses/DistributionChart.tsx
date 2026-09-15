import { Chart, type Row, useChartTheme } from "@ocelescope/charts";
import { useMemo } from "react";
import type { DistributionVisualization } from "../model/dashboard";

/** One distribution row as the backend sends it. */
export interface Bucket {
  label: string;
  count: number;
  kind: "value" | "range" | "other" | "missing";
}

/**
 * Four analyses return the same bucket list, so they share one chart. Buckets
 * arrive ordered and already binned by the backend, which is why nothing here
 * sorts or re-bins them.
 */
export function DistributionChart({
  buckets,
  visualization,
  seriesName,
  loading,
  empty,
  emptyMessage,
}: {
  buckets: Bucket[];
  visualization: DistributionVisualization;
  seriesName: string;
  loading: boolean;
  empty: boolean;
  emptyMessage: string;
}) {
  const theme = useChartTheme();
  const rows = useMemo<Row[]>(
    () =>
      buckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        kind: bucket.kind,
      })),
    [buckets],
  );

  // "Missing" and "Other" are not values of the attribute, so they must not
  // read as just another category.
  const itemColor = (row: Row) =>
    row.kind === "missing"
      ? theme.missing
      : row.kind === "other"
        ? theme.other
        : undefined;

  const shared = { rows, loading, empty, emptyMessage, itemColor };

  return visualization === "donut" ? (
    <Chart
      type="pie"
      {...shared}
      name="label"
      value="count"
      donut
      sort="none"
    />
  ) : (
    <Chart
      type="bar"
      {...shared}
      x="label"
      y="count"
      sort="none"
      flush={visualization === "histogram"}
      yAxis={{ name: seriesName, minInterval: 1 }}
      zoom={{ axis: "x", slider: true, mouse: true }}
    />
  );
}
