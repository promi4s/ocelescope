import type { VisualizationByType } from "../../../../types";
import { DEFAULT_COLORS, DEFAULT_NODE_POSITION } from "./constants/graphFlow";
import type { GraphFlowNodeType } from "./types/graphFlow";
import { hasMarking } from "./utils/labels";
import type { GraphFlowEdgeType } from "./edges/GraphFlowEdge";

export const buildGraphFlowNodes = (
  visualization: VisualizationByType<"graph">,
): GraphFlowNodeType[] =>
  (visualization.nodes ?? []).map((node) => {
    const id = node.id ?? "";
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
            isFinalMarking: node.double_border ?? false,
            isInitialMarking: hasMarking(label, "m0="),
          },
        };

      case "start":
        return {
          id,
          type: "start" as const,
          position: DEFAULT_NODE_POSITION,
          data: { label, color },
        };

      case "end":
        return {
          id,
          type: "end" as const,
          position: DEFAULT_NODE_POSITION,
          data: { label, color },
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
      dashed: edge.dashed ?? false,
    },
  }));
