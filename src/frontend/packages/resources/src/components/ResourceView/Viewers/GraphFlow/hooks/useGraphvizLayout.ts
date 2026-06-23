import { type Engine, Graphviz } from "@hpcc-js/wasm-graphviz";
import type { Edge, Node } from "@xyflow/react";
import { useCallback } from "react";
import { applyEdgeLayouts, applyNodePositions } from "../model/runLayout";
import type {
  GraphFlowModel,
  GraphLayoutPlan,
  GraphLayoutResult,
  GraphPoint,
  GraphVisualization,
} from "../model/types";

type GraphvizLayoutPlan = Extract<GraphLayoutPlan, { type: "graphviz" }>;
export type GraphvizGraphFlowModel = Omit<GraphFlowModel, "layoutPlan"> & {
  layoutPlan: GraphvizLayoutPlan;
};

type GraphvizJSON = {
  bb?: string;
  objects?: Array<{
    name?: string;
    _gvid?: number;
    pos?: string;
    width?: string | number;
    height?: string | number;
  }>;
  edges?: Array<{
    id?: string;
    tail?: string | number;
    head?: string | number;
    pos?: string;
    lp?: string;
  }>;
};

const GRAPHVIZ_DPI = 72;

const quoteDotValue = (value: string) => `"${value.replaceAll('"', '\\"')}"`;

const attrsToDot = (
  attrs?: Record<string, string | number | boolean | undefined | null>,
) => {
  if (!attrs) return "";
  return Object.entries(attrs)
    .filter(([, value]) => value != null)
    .map(([key, value]) =>
      typeof value === "string"
        ? `${key}=${quoteDotValue(value)}`
        : `${key}=${String(value)}`,
    )
    .join(",");
};

const parsePoint = (value?: string): GraphPoint | null => {
  if (!value) return null;
  const [xRaw, yRaw] = value.split(",");
  const x = Number.parseFloat(xRaw ?? "");
  const y = Number.parseFloat(yRaw ?? "");
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const parseBoundingBoxHeight = (bb?: string) => {
  const values = bb?.split(",").map((value) => Number.parseFloat(value));
  const height = values?.[3];
  return Number.isFinite(height) ? (height as number) : 0;
};

const parseGraphvizDimension = (value?: string | number) => {
  if (value == null) return null;
  const dimension = Number.parseFloat(String(value)) * GRAPHVIZ_DPI;
  return Number.isFinite(dimension) ? dimension : null;
};

type GraphvizEdgePosition = {
  points: GraphPoint[];
  startArrowPoint: GraphPoint | null;
  endArrowPoint: GraphPoint | null;
};

const parseGraphvizEdgePosition = (pos?: string): GraphvizEdgePosition => {
  const result: GraphvizEdgePosition = {
    points: [],
    startArrowPoint: null,
    endArrowPoint: null,
  };
  if (!pos) return result;

  const pointMatches = pos.matchAll(
    /(?:^|\s)(?:(s|e),)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
  );
  for (const match of pointMatches) {
    const point = {
      x: Number.parseFloat(match[2] ?? "0"),
      y: Number.parseFloat(match[3] ?? "0"),
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

    if (match[1] === "s") {
      result.startArrowPoint = point;
    } else if (match[1] === "e") {
      result.endArrowPoint = point;
    } else {
      result.points.push(point);
    }
  }

  return result;
};

const flipY = (point: GraphPoint, graphHeight: number): GraphPoint => ({
  x: point.x,
  y: graphHeight - point.y,
});

const buildPolylinePath = (points: GraphPoint[]) => {
  if (points.length < 2) return null;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
    .join(" ");
};

const buildSplinePath = (points: GraphPoint[]) => {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) return null;

  let path = `M ${points[0]?.x},${points[0]?.y}`;
  for (let index = 1; index < points.length; index += 3) {
    const cp1 = points[index];
    const cp2 = points[index + 1];
    const end = points[index + 2];
    if (!cp1 || !cp2 || !end) return null;
    path += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${end.x},${end.y}`;
  }
  return path;
};

const buildGraphvizEdgePath = ({
  points,
  startArrowPoint,
  endArrowPoint,
}: {
  points: GraphPoint[];
  startArrowPoint: GraphPoint | null;
  endArrowPoint: GraphPoint | null;
}) => {
  const splinePath = buildSplinePath(points);
  if (splinePath) {
    return [
      startArrowPoint && points[0]
        ? `M ${startArrowPoint.x},${startArrowPoint.y} L ${points[0].x},${points[0].y}`
        : null,
      startArrowPoint ? splinePath.replace(/^M [^C]+/, "") : splinePath,
      endArrowPoint ? `L ${endArrowPoint.x},${endArrowPoint.y}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return buildPolylinePath([
    ...(startArrowPoint ? [startArrowPoint] : []),
    ...points,
    ...(endArrowPoint ? [endArrowPoint] : []),
  ]);
};

const graphvizShape = (shape: string | null | undefined) => {
  switch (shape) {
    case "circle":
      return "circle";
    case "diamond":
      return "diamond";
    case "hexagon":
      return "hexagon";
    case "triangle":
      return "triangle";
    default:
      return "box";
  }
};

const toDot = (
  visualization: GraphVisualization,
  layoutPlan: GraphvizLayoutPlan,
) => {
  const lines: string[] = [
    "digraph G {",
    `graph [${attrsToDot(layoutPlan.graphAttrs)}];`,
    `node [${attrsToDot(layoutPlan.nodeAttrs)}];`,
    `edge [${attrsToDot(layoutPlan.edgeAttrs)}];`,
  ];

  for (const node of visualization.nodes ?? []) {
    const attrs = {
      ...node.layout_attrs,
      label: node.label ?? "",
      shape: graphvizShape(node.shape),
      color: node.border_color ?? node.color ?? undefined,
      fillcolor: node.color ?? undefined,
      style: node.color ? "filled" : undefined,
      width: node.width ? (node.width / GRAPHVIZ_DPI).toFixed(4) : undefined,
      height: node.height ? (node.height / GRAPHVIZ_DPI).toFixed(4) : undefined,
      fixedsize: node.width && node.height ? true : undefined,
    };
    lines.push(`${quoteDotValue(node.id as string)} [${attrsToDot(attrs)}];`);
  }

  for (const edge of visualization.edges ?? []) {
    const attrs = {
      ...edge.layout_attrs,
      id: edge.id as string,
      label: edge.label ?? undefined,
      color: edge.color ?? undefined,
    };
    lines.push(
      `${quoteDotValue(edge.source)} -> ${quoteDotValue(edge.target)} [${attrsToDot(attrs)}];`,
    );
  }

  const ranks = (visualization.nodes ?? [])
    .filter(({ rank }) => rank != null)
    .reduce<Partial<Record<"source" | "sink" | number, string[]>>>(
      (acc, node) => {
        const key = node.rank as "sink" | "source" | number;
        acc[key] ??= [];
        acc[key].push(quoteDotValue(node.id as string));
        return acc;
      },
      {},
    );

  lines.push(
    ...Object.entries(ranks).map(
      ([rank, ids]) =>
        `{ rank=${["source", "sink"].includes(rank) ? rank : "same"}; ${(ids ?? []).join(" ")} }`,
    ),
  );
  lines.push("}");

  return lines.join("\n");
};

const getGraphvizEdgeKey = (
  edge: NonNullable<GraphvizJSON["edges"]>[number],
  gvidToName: Map<number, string>,
) => {
  const tail =
    typeof edge.tail === "number" ? gvidToName.get(edge.tail) : edge.tail;
  const head =
    typeof edge.head === "number" ? gvidToName.get(edge.head) : edge.head;
  return tail && head ? `${tail}->${head}` : null;
};

const buildGraphvizEdgeLayouts = (
  graphvizEdges: NonNullable<GraphvizJSON["edges"]>,
  graphHeight: number,
  edges: Edge[],
  gvidToName: Map<number, string>,
): GraphLayoutResult["edgeLayouts"] => {
  const fallbackCounts = new Map<string, number>();
  const fallbackIds = edges.reduce<Record<string, string[]>>((acc, edge) => {
    const key = `${edge.source}->${edge.target}`;
    acc[key] ??= [];
    acc[key].push(edge.id);
    return acc;
  }, {});

  return graphvizEdges.reduce<GraphLayoutResult["edgeLayouts"]>((acc, edge) => {
    const edgeKey = getGraphvizEdgeKey(edge, gvidToName);
    const fallbackIdsForKey = edgeKey ? fallbackIds[edgeKey] : undefined;
    const fallbackIndex = edgeKey ? (fallbackCounts.get(edgeKey) ?? 0) : 0;
    const edgeId = edge.id ?? fallbackIdsForKey?.[fallbackIndex];
    if (!edgeId) return acc;

    if (edgeKey) fallbackCounts.set(edgeKey, fallbackIndex + 1);

    const position = parseGraphvizEdgePosition(edge.pos);
    const points = position.points.map((point) => flipY(point, graphHeight));
    const startArrowPoint = position.startArrowPoint
      ? flipY(position.startArrowPoint, graphHeight)
      : null;
    const endArrowPoint = position.endArrowPoint
      ? flipY(position.endArrowPoint, graphHeight)
      : null;
    const path = buildGraphvizEdgePath({
      points,
      startArrowPoint,
      endArrowPoint,
    });
    if (!path) return acc;

    const labelPosition = parsePoint(edge.lp);
    acc[edgeId] = {
      path,
      labelPosition: labelPosition ? flipY(labelPosition, graphHeight) : null,
      startPoint: startArrowPoint ?? points[0] ?? null,
      endPoint: endArrowPoint ?? points.at(-1) ?? null,
    };
    return acc;
  }, {});
};

const runGraphviz = async ({
  visualization,
  nodes,
  edges,
  layoutPlan,
}: {
  visualization: GraphVisualization;
  nodes: Node[];
  edges: Edge[];
  layoutPlan: GraphvizLayoutPlan;
}): Promise<GraphLayoutResult> => {
  const graphviz = await Graphviz.load();
  const json = JSON.parse(
    graphviz.layout(
      toDot(visualization, layoutPlan),
      "json",
      layoutPlan.engine as Engine,
    ),
  ) as GraphvizJSON;

  const graphHeight = parseBoundingBoxHeight(json.bb);
  const gvidToName = new Map<number, string>();
  const positions = (json.objects ?? []).reduce<GraphLayoutResult["positions"]>(
    (acc, object) => {
      if (object._gvid != null && object.name) {
        gvidToName.set(object._gvid, object.name);
      }
      if (!object.name) return acc;

      const center = parsePoint(object.pos);
      if (!center) return acc;

      const node = nodes.find((candidate) => candidate.id === object.name);
      const data = node?.data as
        | { width?: number | null; height?: number | null }
        | undefined;
      const width = data?.width ?? parseGraphvizDimension(object.width) ?? 0;
      const height = data?.height ?? parseGraphvizDimension(object.height) ?? 0;
      const flipped = flipY(center, graphHeight);
      acc[object.name] = {
        x: flipped.x - width / 2,
        y: flipped.y - height / 2,
      };
      return acc;
    },
    {},
  );

  return {
    positions,
    edgeLayouts: buildGraphvizEdgeLayouts(
      json.edges ?? [],
      graphHeight,
      edges,
      gvidToName,
    ),
  };
};

export const useGraphvizLayout = (visualization: GraphVisualization) =>
  useCallback(
    async (model: GraphvizGraphFlowModel) => {
      const layout = await runGraphviz({
        visualization,
        nodes: model.nodes,
        edges: model.edges,
        layoutPlan: model.layoutPlan,
      });

      return {
        nodes: applyNodePositions(model.nodes, layout.positions),
        edges: applyEdgeLayouts(model.edges, layout.edgeLayouts),
      };
    },
    [visualization],
  );
