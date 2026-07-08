import type { GraphEdge, GraphNode } from "@ocelescope/api-base";
import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";

export type GraphVisualization = VisualizationByType<"graph">;
export type GraphEdgeRouting = "SPLINES" | "ORTHOGONAL" | "POLYLINE";

export type GraphPoint = { x: number; y: number };

export type GraphLayoutPlan =
  | {
      type: "graphviz";
      engine: string;
      graphAttrs: Record<string, string | number | boolean>;
      nodeAttrs: Record<string, string | number | boolean>;
      edgeAttrs: Record<string, string | number | boolean>;
    }
  | {
      type: "elk";
      elkOptions: Record<string, string | number | boolean>;
      edgeRouting: GraphEdgeRouting;
    };

export type GraphFlowModel = {
  nodes: GraphFlowNodeType[];
  edges: GraphFlowEdgeType[];
  layoutPlan: GraphLayoutPlan;
};

export type GraphLayoutResult = {
  positions: Record<string, GraphPoint>;
  edgeLayouts: Record<
    string,
    {
      path: string;
      labelPosition?: GraphPoint | null;
      startPoint?: GraphPoint | null;
      endPoint?: GraphPoint | null;
    }
  >;
};

export class GraphVisualizationError extends Error {
  details: string[] | undefined;

  constructor(message: string, details?: string[]) {
    super(message);
    this.name = "GraphVisualizationError";
    this.details = details;
  }
}

// Normalizes anything thrown during build/layout into a GraphVisualizationError
// so the viewer can render a consistent error state.
export const toGraphError = (error: unknown): GraphVisualizationError => {
  if (error instanceof GraphVisualizationError) return error;
  return new GraphVisualizationError("Graph layout failed.", [
    error instanceof Error ? error.message : String(error),
  ]);
};

// React Flow's `Node`/`Edge` generics require `TData extends Record<string, unknown>`.
// The generated backend interfaces don't carry an index signature, so we intersect.
export type GraphFlowNodeData = GraphNode & Record<string, unknown>;
export type GraphFlowNodeType = Node<GraphFlowNodeData, "node">;

// Layout extras attached at runtime by `runLayout` on top of the backend edge.
export type EdgeLayoutExtras = {
  path?: string | null;
  labelPosition?: GraphPoint | null;
  startPoint?: GraphPoint | null;
  endPoint?: GraphPoint | null;
};
export type GraphFlowEdgeData = GraphEdge &
  EdgeLayoutExtras &
  Record<string, unknown>;
export type GraphFlowEdgeType = Edge<GraphFlowEdgeData, "graphflow">;

export type ElkPoint = { x: number; y: number };

export type ElkEdgeSection = {
  startPoint?: ElkPoint;
  bendPoints?: ElkPoint[];
  endPoint?: ElkPoint;
};

export type ElkEdgeLabel = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type ElkEdgeResult = {
  id?: string;
  sections?: ElkEdgeSection[];
  labels?: ElkEdgeLabel[];
  layoutOptions?: Record<string, unknown>;
};

export const DEFAULT_COLORS = {
  edge: "#555555",
  place: "#aec6e8",
  transition: "#ffffff",
  transitionBorder: "#333",
  text: "#1a1a1a",
} as const;
export const MARKING_DOT_SIZE = 12;
export const FIT_VIEW_PADDING = 0.15;
