import { ThemedPlot } from "@r4pm/components/charts";
import type { ChartProps } from "../types";

/** One Plotly trace. `react-plotly.js` types traces as `unknown`, so this
 * names what we put in one rather than pretending to type all of Plotly. */
export type Trace = Record<string, unknown>;

type Click = { points: Array<{ label?: string; x?: unknown; y?: unknown }> };

/**
 * The plot every chart draws on: r4pm's themed Plotly, with the parts that
 * should look the same everywhere - margins, legend, no mode bar - already set.
 */
export const Plot = ({
  traces,
  layout,
  legend = false,
  readName = (point) => String(point?.label ?? point?.x ?? ""),
  onSelect,
}: {
  traces: Trace[];
  layout?: Record<string, unknown>;
  legend?: boolean;
  /** Which of a clicked point's fields names it; a horizontal bar reads `y`. */
  readName?: (point: Click["points"][number]) => string;
  onSelect?: ChartProps["onSelect"];
}) => (
  <ThemedPlot
    data={traces}
    layout={{
      autosize: true,
      margin: { t: legend ? 44 : 12, r: 16, b: 48, l: 56, pad: 2 },
      showlegend: legend,
      clickmode: onSelect ? "event+select" : "event",
      legend: {
        orientation: "h",
        y: 1.02,
        yref: "paper",
        yanchor: "bottom",
        x: 0,
        xanchor: "left",
        bgcolor: "rgba(0,0,0,0)",
      },
      hoverlabel: { namelength: -1 },
      ...layout,
    }}
    config={{
      displaylogo: false,
      displayModeBar: false,
      responsive: true,
      scrollZoom: false,
      doubleClick: "reset",
    }}
    style={{ width: "100%", height: "100%" }}
    useResizeHandler
    onClick={({ points }: Click) =>
      points[0] && onSelect?.(readName(points[0]), points[0])
    }
  />
);

/** An axis that keeps its labels on screen, named after its column. */
export const axis = (
  title: string | undefined,
  range?: readonly [unknown, unknown],
) => ({
  automargin: true,
  ticks: "outside",
  ticklen: 4,
  tickfont: { size: 11 },
  zeroline: false,
  ...(title && { title: { text: title, font: { size: 12 }, standoff: 10 } }),
  ...(range && { range: [...range] }),
});
