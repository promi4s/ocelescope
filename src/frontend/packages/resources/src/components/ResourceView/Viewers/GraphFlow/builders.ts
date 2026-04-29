import type { VisualizationByType } from "../../../../types";
import { DEFAULT_COLORS, DEFAULT_NODE_POSITION } from "./constants/graphFlow";
import type { GraphFlowNodeType } from "./types/graphFlow";
import { hasMarking } from "./utils/labels";
import type { GraphFlowEdgeType } from "./edges/GraphFlowEdge";

type LayoutAttrs = Record<string, unknown> | null | undefined;

const layoutAttrs = (attrs: unknown): LayoutAttrs => attrs as LayoutAttrs;

const isFinalPlace = (attrs: unknown, label: string | null): boolean =>
  layoutAttrs(attrs)?.["peripheries"] === 2 || hasMarking(label, "mf=");

const isVariableEdge = (attrs: unknown): boolean =>
  layoutAttrs(attrs)?.["style"] === "dashed";

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
            isFinalMarking: isFinalPlace(node.layout_attrs, label),
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
      isVariable: isVariableEdge(edge.layout_attrs),
    },
  }));
