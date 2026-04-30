import type { VisualizationByType } from "../../../../types";
import { DEFAULT_COLORS, DEFAULT_NODE_POSITION } from "./constants/graphFlow";
import type { GraphFlowNodeType } from "./types/graphFlow";
import { hasMarking } from "./utils/labels";
import type { GraphFlowEdgeType } from "./edges/GraphFlowEdge";

export const buildGraphFlowNodes = (
  visualization: VisualizationByType<"graph">,
): GraphFlowNodeType[] =>
  (visualization.nodes ?? []).map((node, index) => {
    const id = node.id ?? `node-${index}`;
    const label = node.label ?? null;
    const color = node.color ?? DEFAULT_COLORS.place;

    switch (node.shape) {
      case "circle":
        return {
          id,
          type: "place" as const,
          position: DEFAULT_NODE_POSITION,
          data: {
            label,
            color,
            isFinalMarking: node.style?.double_border ?? false,
            innerSymbol: node.style?.inner_symbol ?? null,
            isInitialMarking: hasMarking(label, "m0="),
          },
        };

      default:
        return {
          id,
          type: "transition" as const,
          position: DEFAULT_NODE_POSITION,
          data: {
            label,
            color: node.color ?? DEFAULT_COLORS.transition,
            borderColor: node.border_color ?? null,
          },
        };
    }
  });

export const buildGraphFlowEdges = (
  visualization: VisualizationByType<"graph">,
): GraphFlowEdgeType[] =>
  (visualization.edges ?? []).map((edge, index) => ({
    id: edge.id ?? `e${index}`,
    source: edge.source,
    target: edge.target,
    type: "graphflow" as const,
    data: {
      color: edge.color ?? DEFAULT_COLORS.edge,
      label: edge.label ?? null,
      dashed: edge.style?.dashed ?? false,
    },
  }));
