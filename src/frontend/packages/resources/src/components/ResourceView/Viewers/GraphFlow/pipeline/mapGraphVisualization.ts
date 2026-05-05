import type { Edge, Node } from "@xyflow/react";
import { DEFAULT_COLORS, DEFAULT_NODE_POSITION } from "../constants/graphFlow";
import type { GraphFlowEdgeType } from "../edges/GraphFlowEdge";
import type { PlaceNodeType } from "../nodes/PlaceNode";
import type { TransitionNodeType } from "../nodes/TransitionNode";
import type {
  BackendGraphEdge,
  BackendGraphNode,
  GraphFlowModel,
  GraphLayoutPlan,
  GraphVisualization,
} from "./types";
import { normalizeElkOptions } from "./validateGraphVisualization";

type GraphFlowNodeType = PlaceNodeType | TransitionNodeType;

const hasFixedPosition = (node: BackendGraphNode) =>
  node.x !== undefined &&
  node.x !== null &&
  node.y !== undefined &&
  node.y !== null;

const getNodePosition = (node: BackendGraphNode) =>
  hasFixedPosition(node)
    ? { x: node.x as number, y: node.y as number }
    : DEFAULT_NODE_POSITION;

const mapNode = (node: BackendGraphNode): GraphFlowNodeType => {
  const id = node.id as string;
  const label = node.label ?? null;
  const color = node.color ?? DEFAULT_COLORS.place;
  const labelPos = node.label_pos ?? "center";
  const width = node.width ?? null;
  const height = node.height ?? null;
  const rank = node.rank ?? null;
  const annotation = node.annotation ?? null;
  const doubleBorder = node.style?.double_border ?? false;
  const innerSymbol = node.style?.inner_symbol ?? null;
  const initialTokens = node.style?.initial_tokens ?? null;
  const finalTokens = node.style?.final_tokens ?? null;

  if (node.shape === "circle") {
    return {
      id,
      type: "place",
      position: getNodePosition(node),
      data: {
        label,
        color,
        borderColor: node.border_color ?? null,
        isFinalMarking: doubleBorder,
        initialTokens,
        finalTokens,
        innerSymbol,
        annotation,
        labelPos,
        width,
        height,
        rank,
      },
    };
  }

  return {
    id,
    type: "transition",
    position: getNodePosition(node),
    data: {
      label,
      shape: node.shape,
      color: node.color ?? DEFAULT_COLORS.transition,
      borderColor: node.border_color ?? null,
      doubleBorder,
      innerSymbol,
      annotation,
      labelPos,
      width,
      height,
      rank,
    },
  };
};

const mapEdge = (edge: BackendGraphEdge): GraphFlowEdgeType => ({
  id: edge.id as string,
  source: edge.source,
  target: edge.target,
  type: "graphflow",
  data: {
    color: edge.color ?? DEFAULT_COLORS.edge,
    label: edge.label ?? null,
    dashed: edge.style?.dashed ?? false,
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
