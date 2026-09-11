import type { ChartTheme, Column, Row, SunburstProps } from "../types";
import { toLabel, toNumber } from "./data";
import type { BuiltChart, ClickParams, OptionBuilder } from "./engine";
import { baseOption, defaultValueFormat } from "./theme";
import { escapeHtml } from "./tooltip";

interface Node {
  name: string;
  /** Sum of the leaves underneath. Drives ring area. */
  value: number;
  /** Authoritative value from `nodeValue`, when the children overlap. */
  reported?: number;
  row: Row;
  rows: Row[];
  children: Map<string, Node>;
}

const emptyNode = (name: string, row: Row): Node => ({
  name,
  value: 0,
  row,
  rows: [],
  children: new Map(),
});

/** The number a node reports, which is its own sum unless overridden. */
const reportedValue = (node: Node): number => node.reported ?? node.value;

const fold = (
  rows: Row[],
  path: Column[],
  value: Column,
  nodeValue: Array<Column | null> = [],
): Node[] => {
  const roots = new Map<string, Node>();

  for (const row of rows) {
    const amount = toNumber(row[value]);
    let level = roots;

    for (const [depth, column] of path.entries()) {
      const name = toLabel(row[column]);
      let node = level.get(name);
      if (!node) {
        node = emptyNode(name, row);
        level.set(name, node);
      }
      node.value += amount;
      node.rows.push(row);

      const override = nodeValue[depth];
      if (override != null && row[override] != null) {
        node.reported = toNumber(row[override]);
      }
      level = node.children;
    }
  }

  return [...roots.values()];
};

interface SunburstDatum {
  name: string;
  value: number;
  children?: SunburstDatum[];
  label?: { show: boolean };
}

const toData = (
  nodes: Node[],
  depth: number,
  labelDepth: number,
  minShare: number,
  parentTotal: number,
): SunburstDatum[] =>
  nodes
    .filter((node) => parentTotal <= 0 || node.value / parentTotal >= minShare)
    .sort((a, b) => b.value - a.value)
    .map((node) => ({
      name: node.name,
      value: node.value,
      ...(depth >= labelDepth ? { label: { show: false } } : {}),
      ...(node.children.size > 0
        ? {
            children: toData(
              [...node.children.values()],
              depth + 1,
              labelDepth,
              minShare,
              node.value,
            ),
          }
        : {}),
    }));

export const sunburstOption: OptionBuilder<SunburstProps> = (
  props: SunburstProps,
  theme: ChartTheme,
): BuiltChart => {
  const {
    rows,
    path,
    value,
    nodeValue,
    labelDepth = 2,
    minShare = 0,
    palette,
    valueFormat = defaultValueFormat,
  } = props;

  const roots = fold(rows, path, value, nodeValue);
  const total = roots.reduce((sum, node) => sum + reportedValue(node), 0);
  const base = baseOption(theme, palette);

  // Index by the ring path so a click can be resolved back to a source row.
  const byPath = new Map<string, Node>();
  const index = (nodes: Node[], prefix: string[]) => {
    for (const node of nodes) {
      const key = JSON.stringify([...prefix, node.name]);
      byPath.set(key, node);
      index([...node.children.values()], [...prefix, node.name]);
    }
  };
  index(roots, []);

  return {
    option: {
      ...base,
      grid: undefined,
      legend: { show: false },
      tooltip: {
        backgroundColor: theme.tooltipBackground,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.text, fontFamily: theme.fontFamily },
        confine: true,
        formatter: (raw: unknown) => {
          const params = raw as {
            treePathInfo?: Array<{ name?: string; value?: number }>;
          };
          const trail = (params.treePathInfo ?? []).slice(1);
          const names = trail.map((step) => step.name ?? "");
          const node = byPath.get(JSON.stringify(names));
          const parent =
            names.length > 1
              ? byPath.get(JSON.stringify(names.slice(0, -1)))
              : undefined;

          const amount = node ? reportedValue(node) : 0;
          const denominator = parent ? reportedValue(parent) : total;
          const share = denominator > 0 ? (amount / denominator) * 100 : 0;

          return [
            `<strong>${escapeHtml(names.join(" / "))}</strong>`,
            valueFormat(amount),
            denominator > 0
              ? `${share.toFixed(1)}% of ${escapeHtml(parent ? parent.name : "all")}`
              : "",
          ]
            .filter(Boolean)
            .join("<br/>");
        },
      },
      series: [
        {
          type: "sunburst",
          radius: [0, "92%"],
          data: toData(roots, 1, labelDepth, minShare, total),
          itemStyle: { borderColor: theme.background, borderWidth: 1 },
          label: { color: theme.text, minAngle: 8 },
          emphasis: { focus: "ancestor" },
        },
      ],
    },
    select: (params: ClickParams) => {
      const path = (params.treePathInfo ?? [])
        .slice(1)
        .map((node) => node.name ?? "");
      const node = byPath.get(JSON.stringify(path));
      if (!node) return undefined;
      return {
        row: node.row,
        rows: node.rows,
        path,
        category: node.name,
        value: reportedValue(node),
      };
    },
  };
};
