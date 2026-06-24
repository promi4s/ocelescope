import type { Edge, Node } from "@xyflow/react";
import type {
  GraphFlowEdgeData,
  GraphFlowModel,
  GraphLayoutResult,
} from "./types";
import { GraphVisualizationError } from "./types";

export const toGraphError = (error: unknown): GraphVisualizationError => {
  if (error instanceof GraphVisualizationError) return error;
  return new GraphVisualizationError("Graph layout failed.", [
    error instanceof Error ? error.message : String(error),
  ]);
};

export const measuredNodesMatchModel = (
  measuredNodes: Node[],
  model: GraphFlowModel,
) => {
  if (measuredNodes.length !== model.nodes.length) return false;
  const measuredNodeIds = new Set(measuredNodes.map((node) => node.id));
  return model.nodes.every((node) => measuredNodeIds.has(node.id));
};

export const applyNodePositions = (
  nodes: Node[],
  positions: GraphLayoutResult["positions"],
): Node[] =>
  nodes.map((node) => {
    const position = positions[node.id];
    return position ? { ...node, position } : node;
  });

export const applyEdgeLayouts = (
  edges: Edge[],
  edgeLayouts: GraphLayoutResult["edgeLayouts"],
): Edge[] =>
  edges.map((edge) => {
    const layout = edgeLayouts[edge.id];
    if (!layout) return edge;
    return {
      ...edge,
      data: {
        ...edge.data,
        path: layout.path,
        labelPosition: layout.labelPosition,
        startPoint: layout.startPoint,
        endPoint: layout.endPoint,
      } as GraphFlowEdgeData,
    };
  });
