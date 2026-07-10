import type { GraphEdge, GraphNode } from "@ocelescope/api-base";
import {
  GraphError,
  type GraphModel,
  type GraphVisualization,
  type ModelEdge,
  type ModelNode,
} from "./types";

// Normalizes a backend node/edge into the domain model, guaranteeing an id.
// The backend assigns a uuid to every node/edge, so a missing id signals a
// malformed graph rather than something we should paper over with a generated
// id (which would break edge source/target references).
const requireNodeId = (node: GraphNode, index: number): ModelNode => {
  if (!node.id) {
    throw new GraphError("Invalid graph node.", [
      `Node at index ${index} is missing an id.`,
    ]);
  }
  return { ...node, id: node.id };
};

const requireEdgeId = (edge: GraphEdge, index: number): ModelEdge => {
  if (!edge.id) {
    throw new GraphError("Invalid graph edge.", [
      `Edge at index ${index} is missing an id.`,
    ]);
  }
  return { ...edge, id: edge.id };
};

// Builds the pure domain model from the backend visualization. This step knows
// nothing about layouting — `layout_config` is read separately by the engine
// selector (see `layout/engine.ts`).
export const buildGraphModel = (
  visualization: GraphVisualization,
): GraphModel => ({
  nodes: (visualization.nodes ?? []).map(requireNodeId),
  edges: (visualization.edges ?? []).map(requireEdgeId),
});
