import { cartesian, traceCount } from "./internal/cartesian";
import { axis, Plot } from "./internal/Plot";
import { type CartesianChartProps, measureOf } from "./types";

export type ScatterChartProps = CartesianChartProps;

/** A point per row, for values that have no order to follow. */
export const ScatterChart = ({ xRange, ...props }: ScatterChartProps) => {
  const measure = measureOf(props.y);

  return (
    <Plot
      traces={cartesian(props, {
        type: "scatter",
        mode: "markers",
        marker: {
          size: props.rows.length > 500 ? 6 : 9,
          opacity: props.rows.length > 500 ? 0.55 : 0.78,
          line: { color: "rgba(128,128,128,0.35)", width: 0.75 },
        },
        hovertemplate: "<b>%{fullData.name}</b><br>%{x}<br>%{y}<extra></extra>",
      })}
      legend={traceCount(props) > 1}
      onSelect={props.onSelect}
      layout={{
        hovermode: "closest",
        hoverdistance: 24,
        dragmode: "zoom",
        xaxis: axis(props.x, xRange),
        yaxis: axis(measure),
      }}
    />
  );
};
