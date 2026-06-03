import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";

export type GraphVisualization = VisualizationByType<"graph">;
export type BackendGraphNode = NonNullable<GraphVisualization["nodes"]>[number];
export type BackendGraphEdge = NonNullable<GraphVisualization["edges"]>[number];

//TODO: Check why this is necessary and if we can remove it by improving the typing of GraphVisualization
export const SUPPORTED_EDGE_ROUTING = [
  "SPLINES",
  "ORTHOGONAL",
  "POLYLINE",
] as const;

export type GraphEdgeRouting = (typeof SUPPORTED_EDGE_ROUTING)[number];

export const isGraphEdgeRouting = (value: string): value is GraphEdgeRouting =>
  (SUPPORTED_EDGE_ROUTING as readonly string[]).includes(value);

export type GraphPoint = { x: number; y: number };

export type GraphLayoutPlan =
  | {
      type: "fixed-positions";
    }
  | {
      type: "elk";
      elkOptions: Record<string, string | number | boolean>;
      edgeRouting: GraphEdgeRouting;
    };

export type GraphFlowModel = {
  nodes: Node[];
  edges: Edge[];
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
