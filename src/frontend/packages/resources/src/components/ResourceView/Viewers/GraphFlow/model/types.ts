import type { GraphEdge, GraphNode } from "@ocelescope/api-base";
import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";

// The raw backend visualization (nodes + edges + layout_config). This is the
// only place the outside world is referenced; everything below is our own
// domain model, deliberately decoupled from the generated API shape.
export type GraphVisualization = VisualizationByType<"graph">;

export type Point = { x: number; y: number };

// ── Domain model ────────────────────────────────────────────────────────────
// Backend nodes/edges with a guaranteed id. This is the ONLY graph shape the
// layout engines and the renderer consume — neither of them ever sees the raw
// visualization or its `layout_config`.

export type ModelNode = GraphNode & { id: string };
export type ModelEdge = GraphEdge & { id: string };

export type GraphModel = {
  nodes: ModelNode[];
  edges: ModelEdge[];
};

// ── Layout contract (the black box) ─────────────────────────────────────────
// A layout engine turns a `GraphModel` into pure geometry: where each node sits
// and how each edge is routed. It returns NO SVG and knows NOTHING about React
// Flow. Swapping or adding an engine only means implementing this contract.

// How a routed edge's `points` are interpreted when drawn:
//   "polyline" — straight segments through every point, in order
//   "spline"   — cubic Bézier control points: [P0, c1, c2, P1, c3, c4, P2, …]
export type EdgeRouteKind = "polyline" | "spline";

export type EdgeRoute = {
  kind: EdgeRouteKind;
  // The body of the route (polyline vertices or spline control points).
  points: Point[];
  // Optional straight segments stitched onto either end of the body. Used for
  // arrow anchors that live outside the spline control points (e.g. Graphviz's
  // `s,`/`e,` points). `null` for engines that don't need them (e.g. ELK).
  startAnchor: Point | null;
  endAnchor: Point | null;
  labelPosition: Point | null;
};

export type LayoutResult = {
  // Top-left node positions in React Flow coordinate space, keyed by node id.
  positions: Record<string, Point>;
  // Best-effort edge routes keyed by edge id. A missing entry means the engine
  // did not route that edge; the renderer supplies a fallback.
  routes: Record<string, EdgeRoute>;
};

// ── Render model (React Flow) ───────────────────────────────────────────────
// React Flow requires node/edge `data` to be an index-signature object, so each
// data type is intersected with `Record<string, unknown>`. Computed layout is
// kept strictly separate from the backend element so the renderer never blurs
// "what the backend said" with "what layout produced".

export type NodeData = { model: ModelNode } & Record<string, unknown>;
export type RenderNode = Node<NodeData, "node">;

// Render-ready geometry for a single edge: an absolute SVG path plus the anchors
// the renderer needs (arrow endpoints and the label position).
export type EdgeLayout = {
  path: string;
  startPoint: Point | null;
  endPoint: Point | null;
  labelPosition: Point | null;
};

export type EdgeData = {
  model: ModelEdge;
  // `null` when neither the engine nor the projection fallback could produce a
  // path; the edge renderer then draws its own last-resort route (self-loop /
  // bezier between the live node handles).
  layout: EdgeLayout | null;
} & Record<string, unknown>;
export type RenderEdge = Edge<EdgeData, "graphflow">;

// ── Errors ──────────────────────────────────────────────────────────────────
// Anything thrown while building the model or running layout is normalized into
// this so the viewer can render one consistent error state.
export class GraphError extends Error {
  details: string[] | undefined;

  constructor(message: string, details?: string[]) {
    super(message);
    this.name = "GraphError";
    this.details = details;
  }
}

export const toGraphError = (error: unknown): GraphError =>
  error instanceof GraphError
    ? error
    : new GraphError("Graph rendering failed.", [
        error instanceof Error ? error.message : String(error),
      ]);

// ── Constants ───────────────────────────────────────────────────────────────
export const DEFAULT_COLORS = {
  edge: "#555555",
  place: "#aec6e8",
  transition: "#ffffff",
  transitionBorder: "#333",
  text: "#1a1a1a",
} as const;
export const MARKING_DOT_SIZE = 12;
export const FIT_VIEW_PADDING = 0.15;

// Fallback node dimensions for plugin nodes that leave a size unset. Built-in
// backend nodes always carry width/height.
export const DEFAULT_NODE_WIDTH = 120;
export const DEFAULT_NODE_HEIGHT = 40;
