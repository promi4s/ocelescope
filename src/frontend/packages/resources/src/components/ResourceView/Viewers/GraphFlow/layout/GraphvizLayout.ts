import { type Engine, Graphviz } from "@hpcc-js/wasm-graphviz";
import type {
  GraphFlowEdgeType,
  GraphLayoutPlan,
  GraphPoint,
} from "../model/types";
import { buildPolylinePath, buildSplinePath } from "./edgePath";
import {
  type EnginePlacement,
  GraphLayout,
  type RoutedEdge,
} from "./GraphLayout";

type GraphvizLayoutPlan = Extract<GraphLayoutPlan, { type: "graphviz" }>;

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

// ─── DOT emission ───────────────────────────────────────────────────────────

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

// ─── Result parsing ─────────────────────────────────────────────────────────

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

// Graphviz uses a bottom-left origin; React Flow uses top-left, so every point
// is mirrored about the graph height.
const flipY = (point: GraphPoint, graphHeight: number): GraphPoint => ({
  x: point.x,
  y: graphHeight - point.y,
});

type GraphvizEdgePosition = {
  points: GraphPoint[];
  startArrowPoint: GraphPoint | null;
  endArrowPoint: GraphPoint | null;
};

// An edge `pos` is a spline point list optionally prefixed with `s,`/`e,`
// arrow anchor points.
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

// Graphviz spline points share the shared builder's control-point convention;
// the arrow anchors are stitched on as straight segments at either end.
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

const graphvizEdgeKey = (
  edge: NonNullable<GraphvizJSON["edges"]>[number],
  gvidToName: Map<number, string>,
) => {
  const tail =
    typeof edge.tail === "number" ? gvidToName.get(edge.tail) : edge.tail;
  const head =
    typeof edge.head === "number" ? gvidToName.get(edge.head) : edge.head;
  return tail && head ? `${tail}->${head}` : null;
};

// Graphviz drops the `id` from parallel edges, so recover it by matching on the
// endpoint pair in emission order. `path` may be null; the base class adds the
// straight fallback.
const toEdgeRoutes = (
  graphvizEdges: NonNullable<GraphvizJSON["edges"]>,
  graphHeight: number,
  rfEdges: GraphFlowEdgeType[],
  gvidToName: Map<number, string>,
): EnginePlacement["edges"] => {
  const fallbackCounts = new Map<string, number>();
  const fallbackIds = rfEdges.reduce<Record<string, string[]>>((acc, edge) => {
    const key = `${edge.source}->${edge.target}`;
    acc[key] ??= [];
    acc[key].push(edge.id);
    return acc;
  }, {});

  return graphvizEdges.reduce<Record<string, RoutedEdge>>((acc, edge) => {
    const edgeKey = graphvizEdgeKey(edge, gvidToName);
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
    const labelPosition = parsePoint(edge.lp);

    acc[edgeId] = {
      path: buildGraphvizEdgePath({ points, startArrowPoint, endArrowPoint }),
      labelPosition: labelPosition ? flipY(labelPosition, graphHeight) : null,
      startPoint: startArrowPoint ?? points[0] ?? null,
      endPoint: endArrowPoint ?? points.at(-1) ?? null,
    };
    return acc;
  }, {});
};

export class GraphvizLayout extends GraphLayout<GraphvizLayoutPlan> {
  // Loading the wasm module is expensive; share one instance across layouts.
  private static instance: Promise<Graphviz> | null = null;

  private static load(): Promise<Graphviz> {
    GraphvizLayout.instance ??= Graphviz.load();
    return GraphvizLayout.instance;
  }

  protected async solve(): Promise<EnginePlacement> {
    const graphviz = await GraphvizLayout.load();
    const json = JSON.parse(
      graphviz.layout(this.toDot(), "json", this.plan.engine as Engine),
    ) as GraphvizJSON;

    const graphHeight = parseBoundingBoxHeight(json.bb);
    const gvidToName = new Map<number, string>();
    const positions: EnginePlacement["positions"] = {};
    const centers: EnginePlacement["centers"] = {};

    for (const object of json.objects ?? []) {
      if (object._gvid != null && object.name) {
        gvidToName.set(object._gvid, object.name);
      }
      if (!object.name) continue;

      const center = parsePoint(object.pos);
      if (!center) continue;

      const node = this.model.nodes.find(
        (candidate) => candidate.id === object.name,
      );
      const width =
        node?.data.width ?? parseGraphvizDimension(object.width) ?? 0;
      const height =
        node?.data.height ?? parseGraphvizDimension(object.height) ?? 0;
      const flipped = flipY(center, graphHeight);
      centers[object.name] = flipped;
      positions[object.name] = {
        x: flipped.x - width / 2,
        y: flipped.y - height / 2,
      };
    }

    return {
      positions,
      centers,
      edges: toEdgeRoutes(
        json.edges ?? [],
        graphHeight,
        this.model.edges,
        gvidToName,
      ),
    };
  }

  private toDot(): string {
    const { graphAttrs, nodeAttrs, edgeAttrs } = this.plan;
    const lines: string[] = [
      "digraph G {",
      `graph [${attrsToDot(graphAttrs)}];`,
      `node [${attrsToDot(nodeAttrs)}];`,
      `edge [${attrsToDot(edgeAttrs)}];`,
    ];

    for (const node of this.model.nodes) {
      const data = node.data;
      const attrs = {
        ...data.layout_attrs,
        label: data.label ?? "",
        shape: graphvizShape(data.shape),
        color: data.border_color ?? data.color ?? undefined,
        fillcolor: data.color ?? undefined,
        style: data.color ? "filled" : undefined,
        width: data.width ? (data.width / GRAPHVIZ_DPI).toFixed(4) : undefined,
        height: data.height
          ? (data.height / GRAPHVIZ_DPI).toFixed(4)
          : undefined,
        fixedsize: data.width && data.height ? true : undefined,
      };
      lines.push(`${quoteDotValue(node.id)} [${attrsToDot(attrs)}];`);
    }

    for (const edge of this.model.edges) {
      const data = edge.data;
      const attrs = {
        ...data?.layout_attrs,
        id: edge.id,
        label: data?.label ?? undefined,
        color: data?.color ?? undefined,
      };
      lines.push(
        `${quoteDotValue(edge.source)} -> ${quoteDotValue(edge.target)} [${attrsToDot(attrs)}];`,
      );
    }

    const ranks = this.model.nodes
      .filter((node) => node.data.rank != null)
      .reduce<Partial<Record<"source" | "sink" | number, string[]>>>(
        (acc, node) => {
          const key = node.data.rank as "sink" | "source" | number;
          acc[key] ??= [];
          acc[key].push(quoteDotValue(node.id));
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
  }
}
