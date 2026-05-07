import type { Edge, Node } from "@xyflow/react";
import { DEFAULT_COLORS, DEFAULT_NODE_POSITION } from "../constants/graphFlow";
import type { GraphFlowEdgeType } from "../edges/types";
import type { GraphFlowNodeType } from "../nodes/types";
import type {
  BackendGraphEdge,
  BackendGraphNode,
  GraphFlowModel,
  GraphLayoutPlan,
  GraphVisualization,
} from "./types";
import { normalizeElkOptions } from "./validateGraphVisualization";

const hasFixedPosition = (node: BackendGraphNode) =>
  node.x !== undefined &&
  node.x !== null &&
  node.y !== undefined &&
  node.y !== null;

const getNodePosition = (node: BackendGraphNode) =>
  hasFixedPosition(node)
    ? { x: node.x as number, y: node.y as number }
    : DEFAULT_NODE_POSITION;

const mapNode = (node: BackendGraphNode): GraphFlowNodeType => ({
  id: node.id as string,
  type: "node",
  position: getNodePosition(node),
  data: {
    label: node.label ?? null,
    shape: node.shape ?? "rectangle",
    color: node.color ?? DEFAULT_COLORS.transition,
    borderColor: node.border_color ?? null,
    doubleBorder: node.style?.double_border ?? null,
    innerSymbol: node.style?.inner_symbol ?? null,
    initialTokens: node.style?.initial_tokens ?? null,
    finalTokens: node.style?.final_tokens ?? null,
    labelPos: node.label_pos ?? "center",
    width: node.width ?? null,
    height: node.height ?? null,
    rank: node.rank ?? null,
    annotation: node.annotation ?? null,
  },
});

const mapEdge = (edge: BackendGraphEdge): GraphFlowEdgeType => ({
  id: edge.id as string,
  source: edge.source,
  target: edge.target,
  type: "graphflow",
  data: {
    color: edge.color ?? DEFAULT_COLORS.edge,
    label: edge.label ?? null,
    dashed: edge.style?.dashed ?? false,
    bold: edge.style?.bold ?? false,
    startArrow: edge.start_arrow ?? null,
    endArrow: edge.end_arrow ?? null,
    startLabel: edge.start_label ?? null,
    endLabel: edge.end_label ?? null,
    annotation: edge.annotation ?? null,
  },
});

const createLayoutPlan = (
  visualization: GraphVisualization,
): GraphLayoutPlan => {
  const nodes = visualization.nodes ?? [];
  const allNodesHavePosition =
    nodes.length > 0 && nodes.every((node) => hasFixedPosition(node));

  if (allNodesHavePosition) {
    return { type: "fixed-positions" };
  }

  const elkOptions = visualization.layout_config?.elk_options ?? {};
  const normalized = normalizeElkOptions(elkOptions);

  return {
    type: "elk",
    elkOptions: normalized.elkOptions,
    edgeRouting: normalized.edgeRouting,
  };
};

export const mapGraphVisualization = (
  visualization: GraphVisualization,
): GraphFlowModel => ({
  nodes: (visualization.nodes ?? []).map(mapNode) as Node[],
  edges: (visualization.edges ?? []).map(mapEdge) as Edge[],
  layoutPlan: createLayoutPlan(visualization),
});
