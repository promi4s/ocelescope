import { Plot } from "./internal/Plot";
import { paint, toSeries } from "./internal/series";
import type { ChartProps } from "./types";

export interface PieChartProps extends ChartProps {
  /** The hole in the middle, as a share of the radius. 0 for a full pie. */
  hole?: number;
}

/** Shares of a whole, one slice per category. */
export const PieChart = ({ hole = 0.5, ...props }: PieChartProps) => {
  // A pie draws one measure; further traces would sit on top of each other.
  const [slices] = toSeries(props);
  const colors = slices && paint(slices, props.colorOf, true);
  const total = slices?.values.reduce<number>(
    (sum, value) => sum + (typeof value === "number" ? value : 0),
    0,
  );
  const compact = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <Plot
      traces={
        slices
          ? [
              {
                type: "pie",
                labels: slices.labels,
                values: slices.values,
                hole,
                sort: false,
                direction: "clockwise",
                rotation: -90,
                textinfo:
                  slices.labels.length <= 8 ? "label+percent" : "percent",
                textposition: slices.labels.length <= 5 ? "inside" : "auto",
                insidetextorientation: "horizontal",
                hovertemplate:
                  "<b>%{label}</b><br>%{value} · %{percent}<extra></extra>",
                marker: {
                  ...(Array.isArray(colors) && { colors }),
                  line: { color: "rgba(128,128,128,0.28)", width: 1.5 },
                },
              },
            ]
          : []
      }
      // Slices are named in the legend; there is no axis to name them.
      legend
      onSelect={props.onSelect}
      layout={{
        margin: { t: 44, r: 12, b: 20, l: 12 },
        uniformtext: { mode: "hide", minsize: 11 },
        ...(hole > 0 &&
          total != null && {
            annotations: [
              {
                text: `<b>${compact.format(total)}</b><br><span style="font-size:11px">total</span>`,
                showarrow: false,
                x: 0.5,
                y: 0.5,
                xanchor: "center",
                yanchor: "middle",
              },
            ],
          }),
      }}
    />
  );
};
