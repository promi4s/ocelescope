import type { Edge, Node } from "@xyflow/react";
import {
  applyEdgeLayouts,
  applyNodePositions,
} from "../applyGraphLayout";
import { createGraphFlowModel } from "../createGraphFlowModel";
import { layoutGraphFlowModel } from "../layoutGraphFlowModel";
import {
  type GraphFlowModel,
  GraphVisualizationError,
  type GraphVisualization,
} from "../types";

export type GraphFlowLayoutSnapshot = {
  model: GraphFlowModel | null;
  nodes: Node[];
  edges: Edge[];
  layoutReady: boolean;
  error: GraphVisualizationError | null;
};

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

export const createInitialLayoutSnapshot = (
  visualization: GraphVisualization,
): GraphFlowLayoutSnapshot => {
  const model = createGraphFlowModel(visualization);
  const layoutReady =
    model.layoutPlan.type === "fixed-positions" || model.nodes.length === 0;

  return {
    model,
    nodes: model.nodes,
    edges: model.edges,
    layoutReady,
    error: null,
  };
};

export const createErrorLayoutSnapshot = (
  error: unknown,
): GraphFlowLayoutSnapshot => ({
  model: null,
  nodes: [],
  edges: [],
  layoutReady: true,
  error: toGraphError(error),
});

export const canRunElkLayout = ({
  error,
  model,
  hasNodes,
  nodesInitialized,
  measuredNodes,
}: {
  error: GraphVisualizationError | null;
  model: GraphFlowModel | null;
  hasNodes: boolean;
  nodesInitialized: boolean;
  measuredNodes: Node[];
}) =>
  Boolean(model) &&
  !error &&
  model?.layoutPlan.type === "elk" &&
  (!hasNodes || nodesInitialized) &&
  (!hasNodes || measuredNodesMatchModel(measuredNodes, model));

export const composeGraphLayout = async ({
  model,
  measuredNodes,
  edges,
}: {
  model: GraphFlowModel;
  measuredNodes: Node[];
  edges: Edge[];
}) => {
  if (model.nodes.length === 0) {
    return { nodes: measuredNodes, edges };
  }

  if (!measuredNodesMatchModel(measuredNodes, model)) {
    return null;
  }

  const layout = await layoutGraphFlowModel({ model, measuredNodes, edges });
  if (!layout) {
    return { nodes: measuredNodes, edges };
  }

  return {
    nodes: applyNodePositions(measuredNodes, layout.positions),
    edges: applyEdgeLayouts(edges, layout.edgeLayouts),
  };
};
