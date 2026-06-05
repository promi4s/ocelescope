import type { GraphEdge, GraphNode } from "@ocelescope/api-base";
import type { Edge, Node } from "@xyflow/react";
import {
  DEFAULT_NODE_POSITION,
  GraphVisualizationError,
  type GraphEdgeRouting,
  type GraphFlowEdgeData,
  type GraphFlowEdgeType,
  type GraphFlowModel,
  type GraphFlowNodeData,
  type GraphFlowNodeType,
  type GraphLayoutPlan,
  type GraphVisualization,
} from "./types";

const EDGE_ROUTING_VALUES = [
  "SPLINES",
  "ORTHOGONAL",
  "POLYLINE",
] as const satisfies readonly GraphEdgeRouting[];

const EDGE_ROUTINGS = new Set<GraphEdgeRouting>(EDGE_ROUTING_VALUES);

const EDGE_ROUTING_KEYS = [
  "elk.edgeRouting",
  "org.eclipse.elk.edgeRouting",
] as const;

export const normalizeEdgeRouting = (value: unknown): GraphEdgeRouting => {
  if (typeof value !== "string") {
    throw new GraphVisualizationError("Invalid ELK edge routing.", [
      `Expected one of ${Array.from(EDGE_ROUTINGS).join(", ")}, got ${String(value)}.`,
    ]);
  }

  const normalized = value.toUpperCase();
  if (!EDGE_ROUTINGS.has(normalized as GraphEdgeRouting)) {
    throw new GraphVisualizationError("Invalid ELK edge routing.", [
      `Unknown edge routing "${value}". Supported values are ${Array.from(EDGE_ROUTINGS).join(", ")}.`,
    ]);
  }

  return normalized as GraphEdgeRouting;
};

const normalizeElkOptions = (
  elkOptions: Record<string, string | number | boolean>,
) => {
  const configured = EDGE_ROUTING_KEYS.flatMap((key) =>
    key in elkOptions ? [normalizeEdgeRouting(elkOptions[key])] : [],
  );
  const edgeRouting = configured[0] ?? "POLYLINE";

  const normalizedOptions = { ...elkOptions };
  for (const key of EDGE_ROUTING_KEYS) {
    if (key in normalizedOptions) normalizedOptions[key] = edgeRouting;
  }

  return { edgeRouting, elkOptions: normalizedOptions };
};

const hasFixedPosition = (node: GraphNode) => node.x != null && node.y != null;

const mapNode = (node: GraphNode): GraphFlowNodeType => ({
  id: node.id as string,
  type: "node",
  position: hasFixedPosition(node)
    ? { x: node.x as number, y: node.y as number }
    : DEFAULT_NODE_POSITION,
  data: node as unknown as GraphFlowNodeData,
});

const mapEdge = (edge: GraphEdge): GraphFlowEdgeType => ({
  id: edge.id as string,
  source: edge.source,
  target: edge.target,
  type: "graphflow",
  data: edge as unknown as GraphFlowEdgeData,
});

const createLayoutPlan = (
  visualization: GraphVisualization,
): GraphLayoutPlan => {
  const nodes = visualization.nodes ?? [];
  if (nodes.length > 0 && nodes.every(hasFixedPosition)) {
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

export const buildGraphFlowModel = (
  visualization: GraphVisualization,
): GraphFlowModel => ({
  nodes: (visualization.nodes ?? []).map(mapNode) as Node[],
  edges: (visualization.edges ?? []).map(mapEdge) as Edge[],
  layoutPlan: createLayoutPlan(visualization),
});
