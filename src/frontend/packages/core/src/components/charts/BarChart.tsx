import { cartesian, traceCount } from "./internal/cartesian";
import { axis, Plot, type Trace } from "./internal/Plot";
import { type CartesianChartProps, measureOf } from "./types";

export interface BarChartProps extends CartesianChartProps {
  /** Stack the traces instead of standing them side by side. */
  stacked?: boolean;
  /** Bars along the x axis, which long category names need. */
  horizontal?: boolean;
}

/** Counts as bars, one per category. */
export const BarChart = ({
  stacked = false,
  horizontal = false,
  xRange,
  ...props
}: BarChartProps) => {
  const measure = measureOf(props.y);
  const count = props.rows.length;
  const traces = cartesian(
    props,
    {
      type: "bar",
      marker: { line: { width: 0 }, cornerradius: 4 },
      ...(count <= 24 && {
        texttemplate: horizontal ? "%{x:~s}" : "%{y:~s}",
        textposition: "auto",
      }),
      hovertemplate: horizontal
        ? `<b>%{y}</b><br>${measure}: %{x}<extra>%{fullData.name}</extra>`
        : `<b>%{x}</b><br>${measure}: %{y}<extra>%{fullData.name}</extra>`,
      cliponaxis: false,
    },
    horizontal,
  );

  return (
    <Plot
      traces={stacked ? withStackShare(traces, horizontal, measure) : traces}
      legend={traceCount(props) > 1}
      readName={(point) =>
        String((horizontal ? point.y : point.x) ?? point.label ?? "")
      }
      onSelect={props.onSelect}
      layout={{
        barmode: stacked ? "stack" : "group",
        bargap: 0.22,
        bargroupgap: 0.08,
        hovermode: "closest",
        uniformtext: { mode: "hide", minsize: 10 },
        xaxis: axis(horizontal ? measure : props.x, xRange),
        yaxis: axis(horizontal ? props.x : measure),
      }}
    />
  );
};

/** Add each segment's share of its complete bar to stacked-bar hover. */
const withStackShare = (
  traces: Trace[],
  horizontal: boolean,
  measure: string,
): Trace[] => {
  const totals = new Map<string, number>();
  for (const trace of traces) {
    const labels = (horizontal ? trace.y : trace.x) as unknown[];
    const values = (horizontal ? trace.x : trace.y) as unknown[];
    labels.forEach((label, index) => {
      const key = String(label);
      totals.set(key, (totals.get(key) ?? 0) + Number(values[index] ?? 0));
    });
  }

  return traces.map((trace) => {
    const labels = (horizontal ? trace.y : trace.x) as unknown[];
    const values = (horizontal ? trace.x : trace.y) as unknown[];
    const shares = labels.map((label, index) => {
      const total = totals.get(String(label)) ?? 0;
      return total > 0 ? Number(values[index] ?? 0) / total : 0;
    });
    return {
      ...trace,
      customdata: shares,
      hovertemplate: horizontal
        ? `<b>%{y}</b><br>${measure}: %{x}<br>Share: %{customdata:.1%}<extra>%{fullData.name}</extra>`
        : `<b>%{x}</b><br>${measure}: %{y}<br>Share: %{customdata:.1%}<extra>%{fullData.name}</extra>`,
    };
  });
};
