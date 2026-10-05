import { useViewerConfig } from "@r4pm/components";
import { axis, Plot } from "./internal/Plot";
import { useChart } from "./internal/useChart";
import { type ChartProps, measureOf } from "./types";

export interface HistogramChartProps extends Omit<ChartProps, "series"> {
  /** Column holding each bin's upper edge; `x` holds its lower one. A row
   * without a lower edge counts everything below its upper one, and the
   * other way round - so outliers get a bar of their own instead of
   * stretching the axis. */
  xEnd: string;
}

/**
 * A distribution as bins along a numeric axis.
 *
 * The rows are the bins, already counted: a histogram of a whole log is
 * computed where the log is, not from every value sent to the browser. Bars
 * touch and are as wide as their bin, so unequal bins and gaps where nothing
 * fell read as what they are.
 */
export const HistogramChart = ({ xEnd, ...given }: HistogramChartProps) => {
  const props = useChart(given);
  const { format } = useViewerConfig({});
  const measure = measureOf(props.y);
  const number = format?.number ?? defaultNumber;

  const bins = props.rows.map((row) => ({
    from: edge(row[props.x]),
    to: edge(row[xEnd]),
    count: Number(row[measure] ?? 0),
  }));
  // An open-ended bin has no width of its own, so it borrows a typical one.
  const typical = median(
    bins.flatMap((bin) =>
      bin.from !== undefined && bin.to !== undefined ? [bin.to - bin.from] : [],
    ),
  );
  const bars = bins.flatMap(({ from, to, count }) => {
    if (from === undefined && to === undefined) return [];
    let start = from ?? (to as number) - typical;
    let end = to ?? (from as number) + typical;
    // Every value the same makes one bin without width; draw it around it.
    if (end === start) {
      start -= typical / 2;
      end += typical / 2;
    }
    return [
      {
        center: (start + end) / 2,
        width: end - start,
        count,
        open: from === undefined || to === undefined,
        label:
          from === undefined
            ? `< ${number(to as number)}`
            : to === undefined
              ? `> ${number(from)}`
              : from === to
                ? number(from)
                : `${number(from)} – ${number(to)}`,
      },
    ];
  });
  const color = props.colorOf?.(props.x);

  return (
    <Plot
      traces={[
        {
          type: "bar",
          x: bars.map((bar) => bar.center),
          y: bars.map((bar) => bar.count),
          width: bars.map((bar) => bar.width),
          customdata: bars.map((bar) => bar.label),
          hovertemplate: `<b>%{customdata}</b><br>${measure}: %{y}<extra></extra>`,
          marker: {
            ...(color && { color }),
            line: { color: "rgba(128,128,128,0.45)", width: 1 },
            // Everything beyond the binned range, not one bin's worth of it.
            pattern: {
              shape: bars.map((bar) => (bar.open ? "/" : "")),
              fillmode: "overlay",
            },
            opacity: bars.map((bar) => (bar.open ? 0.55 : 1)),
          },
        },
      ]}
      readName={(point) => String(point.x ?? "")}
      onSelect={props.onSelect}
      layout={{
        bargap: 0,
        hovermode: "closest",
        xaxis: axis(props.x),
        yaxis: axis(measure),
      }}
    />
  );
};

/** A bin edge: a number, or nothing where the bin is open-ended. */
const edge = (value: unknown) => {
  if (value == null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

/** The middle width, or 1 where no bin has one to go by. */
const median = (values: number[]) => {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 1;
};

const defaultNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 }).format(
    value,
  );
