import { Plot, type Trace } from "./internal/Plot";
import { type ChartProps, label, measureOf, type Row } from "./types";

export interface SunburstChartProps extends ChartProps {
  /** The rings, innermost first. Defaults to the category, then the series. */
  path?: readonly string[];
}

/** A hierarchy as rings, each one a column of the path. */
export const SunburstChart = ({ path, ...props }: SunburstChartProps) => {
  const rings = path ?? [props.x, props.series].filter(named);

  return (
    <Plot
      traces={[nest(props.rows, rings, measureOf(props.y), props.colorOf)]}
      onSelect={props.onSelect}
      layout={{
        margin: { t: 12, r: 12, b: 12, l: 12 },
        uniformtext: { mode: "hide", minsize: 10 },
      }}
    />
  );
};

/**
 * The rows as a tree: a node's value is the sum of the rows beneath it.
 *
 * Ids keep the rings apart where two of them carry the same name - an activity
 * and an object type both called "order".
 */
const nest = (
  rows: readonly Row[],
  path: readonly string[],
  measure: string,
  colorOf: ChartProps["colorOf"],
): Trace => {
  const nodes = new Map<
    string,
    { label: string; parent: string; value: number }
  >();

  for (const row of rows) {
    const value = Number(row[measure] ?? 0);
    let parent = "";
    for (const column of path) {
      const name = label(row[column]);
      const id = parent ? `${parent}/${name}` : name;
      const node = nodes.get(id) ?? { label: name, parent, value: 0 };
      node.value += value;
      nodes.set(id, node);
      parent = id;
    }
  }

  const entries = [...nodes];
  return {
    type: "sunburst",
    ids: entries.map(([id]) => id),
    labels: entries.map(([, node]) => node.label),
    parents: entries.map(([, node]) => node.parent),
    values: entries.map(([, node]) => node.value),
    branchvalues: "total",
    sort: false,
    insidetextorientation: "radial",
    hovertemplate:
      "<b>%{label}</b><br>%{value}<br>%{percentParent:.1%} of parent<extra></extra>",
    maxdepth: path.length,
    marker: {
      line: { color: "rgba(128,128,128,0.28)", width: 1.25 },
      ...(colorOf && {
        colors: entries.map(([, node]) => colorOf(node.label)),
      }),
    },
  };
};

const named = (column: string | undefined): column is string => Boolean(column);
