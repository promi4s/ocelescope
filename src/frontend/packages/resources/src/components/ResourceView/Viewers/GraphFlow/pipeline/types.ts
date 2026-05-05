import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";

export type GraphVisualization = VisualizationByType<"graph">;
export type BackendGraphNode = NonNullable<GraphVisualization["nodes"]>[number];
export type BackendGraphEdge = NonNullable<GraphVisualization["edges"]>[number];
export type BackendVisualization = { type?: string } | null;

export type GraphNodeShape = NonNullable<BackendGraphNode["shape"]>;
export type GraphLabelPosition = NonNullable<BackendGraphNode["label_pos"]>;
export type GraphNodeRank = NonNullable<BackendGraphNode["rank"]>;
export type GraphEdgeArrow = NonNullable<BackendGraphEdge["end_arrow"]>;
export type GraphEdgeRouting = "SPLINES" | "ORTHOGONAL" | "POLYLINE";

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
