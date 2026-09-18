import { axis, Plot } from "./internal/Plot";
import { paint, toSeries } from "./internal/series";
import { type CartesianChartProps, measureOf } from "./types";

export interface LineChartProps extends CartesianChartProps {
  /** Hold each value until the next one, instead of sloping between them.
   * What a thing was worth between two readings is what it last read. */
  step?: boolean;
  /** Give every line its own overlaid scale. Useful when the series have
   * different units or ranges. Axes alternate left and right and use the
   * line colour, so the association stays visible without separate plots. */
  yAxes?: "shared" | "independent";
}

/** Lines through ordered values, optionally with one scale per line. */
export const LineChart = ({
  step = false,
  yAxes = "shared",
  xRange,
  ...props
}: LineChartProps) => {
  const groups = toSeries(props);
  const independent = yAxes === "independent" && groups.length > 1;
  const colors = groups.map((group) => {
    const color = paint(group, props.colorOf, false);
    return typeof color === "string" ? color : undefined;
  });
  const traces = groups.map((group, index) => ({
    type: "scatter",
    mode: step || group.values.length <= 40 ? "lines+markers" : "lines",
    name: group.name,
    x: group.labels,
    y: group.values,
    ...(independent && { yaxis: index === 0 ? "y" : `y${index + 1}` }),
    line: {
      width: 2,
      ...(step && { shape: "hv" }),
      ...(colors[index] && { color: colors[index] }),
    },
    marker: {
      size: 5,
      ...(colors[index] && { color: colors[index] }),
    },
    connectgaps: false,
    hovertemplate: "<b>%{fullData.name}</b><br>%{x}<br>%{y}<extra></extra>",
  }));

  const yLayout = independent
    ? Object.fromEntries(
        groups.map((group, index) => [
          index === 0 ? "yaxis" : `yaxis${index + 1}`,
          {
            ...axis(group.name),
            ...(index > 0 && {
              overlaying: "y",
              side: index % 2 === 0 ? "left" : "right",
              anchor: "free",
              autoshift: true,
              showgrid: false,
              zeroline: false,
            }),
            ...(colors[index] && {
              tickfont: { color: colors[index] },
              title: { text: group.name, font: { color: colors[index] } },
            }),
          },
        ]),
      )
    : { yaxis: axis(measureOf(props.y)) };

  return (
    <Plot
      traces={traces}
      legend={groups.length > 1}
      onSelect={props.onSelect}
      layout={{
        hovermode: "x unified",
        xaxis: axis(props.x, xRange),
        ...yLayout,
      }}
    />
  );
};
