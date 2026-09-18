import { cartesian, traceCount } from "./internal/cartesian";
import { axis, Plot } from "./internal/Plot";
import { type CartesianChartProps, measureOf } from "./types";

export type AreaChartProps = CartesianChartProps;

/** A line with the ground beneath it filled in, for totals over time. */
export const AreaChart = ({ xRange, ...props }: AreaChartProps) => {
  const measure = measureOf(props.y);

  return (
    <Plot
      traces={cartesian(
        props,
        {
          type: "scatter",
          mode: "lines",
          fill: "tozeroy",
          line: { width: 2, shape: "spline", smoothing: 0.35 },
          opacity: 0.72,
          connectgaps: false,
          hovertemplate:
            "<b>%{fullData.name}</b><br>%{x}<br>%{y}<extra></extra>",
        },
        false,
        false,
      )}
      legend={traceCount(props) > 1}
      onSelect={props.onSelect}
      layout={{
        hovermode: "x unified",
        hoverdistance: 40,
        spikedistance: -1,
        xaxis: axis(props.x, xRange),
        yaxis: axis(measure),
      }}
    />
  );
};
