import ELK from "elkjs/lib/elk.bundled.js";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type EdgeRoute,
  GraphError,
  type GraphModel,
  type LayoutResult,
  type ModelEdge,
  type ModelNode,
  type Point,
} from "../model/types";
import type { LayoutEngine } from "./engine";

export type ElkEngineConfig = {
  options: Record<string, string | number | boolean>;
};

// ── Edge routing ────────────────────────────────────────────────────────────
// ELK reports how it routed each edge; that determines how we read its section
// geometry (spline control points vs. plain polyline vertices).
type EdgeRouting = "SPLINES" | "ORTHOGONAL" | "POLYLINE";

const EDGE_ROUTINGS = new Set<EdgeRouting>([
  "SPLINES",
  "ORTHOGONAL",
  "POLYLINE",
]);
const EDGE_ROUTING_KEYS = [
  "elk.edgeRouting",
  "org.eclipse.elk.edgeRouting",
] as const;

const normalizeEdgeRouting = (value: unknown): EdgeRouting => {
  if (typeof value !== "string") {
    throw new GraphError("Invalid ELK edge routing.", [
      `Expected one of ${[...EDGE_ROUTINGS].join(", ")}, got ${String(value)}.`,
    ]);
  }
  const normalized = value.toUpperCase();
  if (!EDGE_ROUTINGS.has(normalized as EdgeRouting)) {
    throw new GraphError("Invalid ELK edge routing.", [
      `Unknown edge routing "${value}". Supported values are ${[...EDGE_ROUTINGS].join(", ")}.`,
    ]);
  }
  return normalized as EdgeRouting;
};

// Pins the graph-level routing to a single valid value and rewrites every
// routing key to it, so ELK and our section parsing agree.
const resolveGraphRouting = (
  options: Record<string, string | number | boolean>,
): {
  routing: EdgeRouting;
  options: Record<string, string | number | boolean>;
} => {
  const configured = EDGE_ROUTING_KEYS.flatMap((key) =>
    key in options ? [normalizeEdgeRouting(options[key])] : [],
  );
  const routing = configured[0] ?? "POLYLINE";

  const normalized = { ...options };
  for (const key of EDGE_ROUTING_KEYS) {
    if (key in normalized) normalized[key] = routing;
  }
  return { routing, options: normalized };
};

// ── ELK result shapes (only the fields we read) ─────────────────────────────
type ElkPoint = { x: number; y: number };
type ElkSection = {
  startPoint?: ElkPoint;
  bendPoints?: ElkPoint[];
  endPoint?: ElkPoint;
};
type ElkEdge = {
  id?: string;
  sections?: ElkSection[];
  labels?: Array<{ x?: number; y?: number; width?: number; height?: number }>;
  layoutOptions?: Record<string, unknown>;
};
type ElkChild = {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

// ── Section → geometry ──────────────────────────────────────────────────────
const sectionPoints = (section: ElkSection): Point[] => {
  if (!section.startPoint || !section.endPoint) return [];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
};

// A valid cubic spline needs a leading anchor plus (control, control, anchor)
// triples: length ≥ 4 and (length − 1) % 3 === 0.
const isSplineControlList = (points: Point[]) =>
  points.length >= 4 && (points.length - 1) % 3 === 0;

// ELK SPLINES encode bend points as `(control, control, anchor)` triples after
// the start anchor; the final anchor may be omitted (then it's the section end).
// If that produces a valid control list we route it as a spline, otherwise we
// fall back to a plain polyline through the section points — and we let the
// engine, which knows ELK's convention, make that call.
const routeSection = (
  section: ElkSection,
  routing: EdgeRouting,
): Omit<EdgeRoute, "labelPosition"> | null => {
  const points = sectionPoints(section);
  if (points.length < 2) return null;

  if (routing === "SPLINES" && section.startPoint) {
    const control: Point[] = [
      section.startPoint,
      ...(section.bendPoints ?? []),
    ];
    if ((control.length - 1) % 3 === 2 && section.endPoint) {
      control.push(section.endPoint);
    }
    if (isSplineControlList(control)) {
      return {
        kind: "spline",
        points: control,
        startAnchor: null,
        endAnchor: null,
      };
    }
  }

  return { kind: "polyline", points, startAnchor: null, endAnchor: null };
};

const sectionMidpoint = (section: ElkSection): Point | null => {
  const points = sectionPoints(section);
  const mid = points[Math.floor(points.length / 2)];
  return mid ? { x: mid.x, y: mid.y } : null;
};

const labelPosition = (edge: ElkEdge, section: ElkSection): Point | null => {
  const label = edge.labels?.[0];
  if (label?.x != null && label?.y != null) {
    return {
      x: label.x + (label.width ?? 0) / 2,
      y: label.y + (label.height ?? 0) / 2,
    };
  }
  return sectionMidpoint(section);
};

const edgeRoutingOf = (edge: ElkEdge, fallback: EdgeRouting): EdgeRouting => {
  const options = edge.layoutOptions ?? {};
  const routing =
    options["elk.edgeRouting"] ?? options["org.eclipse.elk.edgeRouting"];
  return routing === undefined ? fallback : normalizeEdgeRouting(routing);
};

// ── Deterministic input order keeps ELK output stable across renders ─────────
const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
const byEndpoints = (a: ModelEdge, b: ModelEdge) =>
  a.source.localeCompare(b.source) ||
  a.target.localeCompare(b.target) ||
  a.id.localeCompare(b.id);

const nodeSize = (node: ModelNode) => ({
  width: node.width ?? DEFAULT_NODE_WIDTH,
  height: node.height ?? DEFAULT_NODE_HEIGHT,
});

// Sizes are backend-authoritative, so ELK lays out purely from the model with
// no render-then-measure round trip.
export class ElkEngine implements LayoutEngine {
  private static readonly elk = new ELK();

  constructor(private readonly config: ElkEngineConfig) {}

  async run(model: GraphModel): Promise<LayoutResult> {
    const { routing, options } = resolveGraphRouting(this.config.options);

    const hasIntegerRanks = model.nodes.some(
      (node) => typeof node.rank === "number",
    );
    const layoutOptions: Record<string, string | number | boolean> =
      hasIntegerRanks
        ? { "elk.partitioning.activate": true, ...options }
        : options;

    const graph = await ElkEngine.elk.layout({
      id: "root",
      layoutOptions: layoutOptions as Record<string, string>,
      children: [...model.nodes].sort(byId).map((node) => {
        const { width, height } = nodeSize(node);
        return {
          id: node.id,
          width,
          height,
          layoutOptions: this.nodeLayoutOptions(node) as Record<string, string>,
        };
      }),
      edges: [...model.edges].sort(byEndpoints).map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
        layoutOptions: (edge.layout_attrs ?? {}) as Record<string, string>,
        ...(edge.label
          ? {
              labels: [
                {
                  text: String(edge.label),
                  width: String(edge.label).length * 7 + 12,
                  height: 18,
                },
              ],
            }
          : {}),
      })),
    });

    return {
      positions: this.readPositions(graph.children as ElkChild[] | undefined),
      routes: this.readRoutes(graph.edges as ElkEdge[] | undefined, routing),
    };
  }

  private nodeLayoutOptions(
    node: ModelNode,
  ): Record<string, string | number | boolean> {
    const options: Record<string, string | number | boolean> = {
      ...(node.layout_attrs ?? {}),
    };
    const rank = node.rank ?? null;
    if (rank === "source") {
      options["elk.layered.layering.layerConstraint"] = "FIRST";
    } else if (rank === "sink") {
      options["elk.layered.layering.layerConstraint"] = "LAST";
    } else if (typeof rank === "number") {
      options["elk.partitioning.partition"] = String(rank);
    }
    return options;
  }

  // ELK echoes each child's placement; the top-left position is exactly what
  // React Flow needs.
  private readPositions(children: ElkChild[] = []): Record<string, Point> {
    const positions: Record<string, Point> = {};
    for (const child of children) {
      if (child.id && child.x != null && child.y != null) {
        positions[child.id] = { x: child.x, y: child.y };
      }
    }
    return positions;
  }

  // Sections are keyed by the ELK edge id, which is the id we passed in, so
  // routes map back to edges directly.
  private readRoutes(
    edges: ElkEdge[] = [],
    graphRouting: EdgeRouting,
  ): Record<string, EdgeRoute> {
    const routes: Record<string, EdgeRoute> = {};
    for (const edge of edges) {
      const section = edge.sections?.[0];
      if (!edge.id || !section) continue;
      const routed = routeSection(section, edgeRoutingOf(edge, graphRouting));
      if (!routed) continue;
      routes[edge.id] = {
        ...routed,
        labelPosition: labelPosition(edge, section),
      };
    }
    return routes;
  }
}
