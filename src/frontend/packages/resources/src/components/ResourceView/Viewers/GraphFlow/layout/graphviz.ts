import { type Engine, Graphviz } from "@hpcc-js/wasm-graphviz";
import type {
  EdgeRoute,
  GraphModel,
  LayoutResult,
  ModelEdge,
  ModelNode,
  Point,
} from "../model/types";
import type { LayoutEngine } from "./engine";

export type GraphvizEngineConfig = {
  engine: string;
  graphAttrs: Record<string, string | number | boolean>;
  nodeAttrs: Record<string, string | number | boolean>;
  edgeAttrs: Record<string, string | number | boolean>;
};

const GRAPHVIZ_DPI = 72;

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

// ── Result parsing helpers ──────────────────────────────────────────────────
const parsePoint = (value?: string): Point | null => {
  if (!value) return null;
  const [xRaw, yRaw] = value.split(",");
  const x = Number.parseFloat(xRaw ?? "");
  const y = Number.parseFloat(yRaw ?? "");
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const parseBoundingBoxHeight = (bb?: string) => {
  const height = bb?.split(",").map((v) => Number.parseFloat(v))?.[3];
  return Number.isFinite(height) ? (height as number) : 0;
};

const parseDimension = (value?: string | number) => {
  if (value == null) return null;
  const dimension = Number.parseFloat(String(value)) * GRAPHVIZ_DPI;
  return Number.isFinite(dimension) ? dimension : null;
};

// Graphviz uses a bottom-left origin; React Flow uses top-left, so every point
// is mirrored about the graph height before it leaves this engine.
const flipY = (point: Point, graphHeight: number): Point => ({
  x: point.x,
  y: graphHeight - point.y,
});

type EdgePosition = {
  points: Point[];
  startArrow: Point | null;
  endArrow: Point | null;
};

// An edge `pos` is a spline point list optionally prefixed with `s,`/`e,` arrow
// anchor points.
const parseEdgePosition = (pos?: string): EdgePosition => {
  const result: EdgePosition = { points: [], startArrow: null, endArrow: null };
  if (!pos) return result;

  const matches = pos.matchAll(
    /(?:^|\s)(?:(s|e),)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
  );
  for (const match of matches) {
    const point = {
      x: Number.parseFloat(match[2] ?? "0"),
      y: Number.parseFloat(match[3] ?? "0"),
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    if (match[1] === "s") result.startArrow = point;
    else if (match[1] === "e") result.endArrow = point;
    else result.points.push(point);
  }
  return result;
};

// Recover an edge's endpoint pair. Graphviz refers to nodes by `_gvid` on
// parallel edges, so we translate back to node names.
const edgeEndpointKey = (
  edge: NonNullable<GraphvizJSON["edges"]>[number],
  gvidToName: Map<number, string>,
) => {
  const tail =
    typeof edge.tail === "number" ? gvidToName.get(edge.tail) : edge.tail;
  const head =
    typeof edge.head === "number" ? gvidToName.get(edge.head) : edge.head;
  return tail && head ? `${tail}->${head}` : null;
};

// ── DOT emission ────────────────────────────────────────────────────────────
const quote = (value: string) => `"${value.replaceAll('"', '\\"')}"`;

const attrsToDot = (
  attrs?: Record<string, string | number | boolean | undefined | null>,
) =>
  attrs
    ? Object.entries(attrs)
        .filter(([, value]) => value != null)
        .map(([key, value]) =>
          typeof value === "string"
            ? `${key}=${quote(value)}`
            : `${key}=${String(value)}`,
        )
        .join(",")
    : "";

const dotShape = (shape: ModelNode["shape"] | null | undefined) => {
  switch (shape) {
    case "circle":
    case "diamond":
    case "hexagon":
    case "triangle":
      return shape;
    default:
      return "box";
  }
};

export class GraphvizEngine implements LayoutEngine {
  // Loading the wasm module is expensive; share one instance across layouts.
  private static instance: Promise<Graphviz> | null = null;

  constructor(private readonly config: GraphvizEngineConfig) {}

  private static load(): Promise<Graphviz> {
    GraphvizEngine.instance ??= Graphviz.load();
    return GraphvizEngine.instance;
  }

  async run(model: GraphModel): Promise<LayoutResult> {
    const graphviz = await GraphvizEngine.load();
    const json = JSON.parse(
      graphviz.layout(this.toDot(model), "json", this.config.engine as Engine),
    ) as GraphvizJSON;

    const graphHeight = parseBoundingBoxHeight(json.bb);
    const gvidToName = new Map<number, string>();
    const positions: Record<string, Point> = {};

    for (const object of json.objects ?? []) {
      if (object._gvid != null && object.name) {
        gvidToName.set(object._gvid, object.name);
      }
      if (!object.name) continue;

      const center = parsePoint(object.pos);
      if (!center) continue;

      const node = model.nodes.find(
        (candidate) => candidate.id === object.name,
      );
      const width = node?.width ?? parseDimension(object.width) ?? 0;
      const height = node?.height ?? parseDimension(object.height) ?? 0;
      const flipped = flipY(center, graphHeight);
      positions[object.name] = {
        x: flipped.x - width / 2,
        y: flipped.y - height / 2,
      };
    }

    return {
      positions,
      routes: this.readRoutes(
        json.edges ?? [],
        graphHeight,
        model.edges,
        gvidToName,
      ),
    };
  }

  // Graphviz drops the `id` from parallel edges, so recover it by matching on
  // the endpoint pair in emission order.
  private readRoutes(
    graphvizEdges: NonNullable<GraphvizJSON["edges"]>,
    graphHeight: number,
    modelEdges: ModelEdge[],
    gvidToName: Map<number, string>,
  ): Record<string, EdgeRoute> {
    const idsByKey = modelEdges.reduce<Record<string, string[]>>(
      (acc, edge) => {
        const key = `${edge.source}->${edge.target}`;
        acc[key] ??= [];
        acc[key].push(edge.id);
        return acc;
      },
      {},
    );
    const consumed = new Map<string, number>();
    const routes: Record<string, EdgeRoute> = {};

    for (const edge of graphvizEdges) {
      const key = edgeEndpointKey(edge, gvidToName);
      const index = key ? (consumed.get(key) ?? 0) : 0;
      const id = edge.id ?? (key ? idsByKey[key]?.[index] : undefined);
      if (!id) continue;
      if (key) consumed.set(key, index + 1);

      const position = parseEdgePosition(edge.pos);
      const points = position.points.map((point) => flipY(point, graphHeight));
      const label = parsePoint(edge.lp);

      routes[id] = {
        // Graphviz `pos` points follow the spline control-point convention; the
        // renderer decides whether the list is drawable as a spline.
        kind: "spline",
        points,
        startAnchor: position.startArrow
          ? flipY(position.startArrow, graphHeight)
          : null,
        endAnchor: position.endArrow
          ? flipY(position.endArrow, graphHeight)
          : null,
        labelPosition: label ? flipY(label, graphHeight) : null,
      };
    }
    return routes;
  }

  private toDot(model: GraphModel): string {
    const { graphAttrs, nodeAttrs, edgeAttrs } = this.config;
    const lines: string[] = [
      "digraph G {",
      `graph [${attrsToDot(graphAttrs)}];`,
      `node [${attrsToDot(nodeAttrs)}];`,
      `edge [${attrsToDot(edgeAttrs)}];`,
    ];

    for (const node of model.nodes) {
      const attrs = {
        ...node.layout_attrs,
        label: node.label ?? "",
        shape: dotShape(node.shape),
        color: node.border_color ?? node.color ?? undefined,
        fillcolor: node.color ?? undefined,
        style: node.color ? "filled" : undefined,
        width: node.width ? (node.width / GRAPHVIZ_DPI).toFixed(4) : undefined,
        height: node.height
          ? (node.height / GRAPHVIZ_DPI).toFixed(4)
          : undefined,
        fixedsize: node.width && node.height ? true : undefined,
      };
      lines.push(`${quote(node.id)} [${attrsToDot(attrs)}];`);
    }

    for (const edge of model.edges) {
      const attrs = {
        ...edge.layout_attrs,
        id: edge.id,
        label: edge.label ?? undefined,
        color: edge.color ?? undefined,
      };
      lines.push(
        `${quote(edge.source)} -> ${quote(edge.target)} [${attrsToDot(attrs)}];`,
      );
    }

    lines.push(...this.rankConstraints(model.nodes), "}");
    return lines.join("\n");
  }

  private rankConstraints(nodes: ModelNode[]): string[] {
    const ranks = nodes
      .filter((node) => node.rank != null)
      .reduce<Partial<Record<"source" | "sink" | number, string[]>>>(
        (acc, node) => {
          const key = node.rank as "sink" | "source" | number;
          acc[key] ??= [];
          acc[key].push(quote(node.id));
          return acc;
        },
        {},
      );

    return Object.entries(ranks).map(
      ([rank, ids]) =>
        `{ rank=${["source", "sink"].includes(rank) ? rank : "same"}; ${(ids ?? []).join(" ")} }`,
    );
  }
}
