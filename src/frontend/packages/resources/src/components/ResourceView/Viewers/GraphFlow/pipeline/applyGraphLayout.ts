import type { Edge, Node } from "@xyflow/react";
import type { GraphLayoutResult } from "./types";

export const applyNodePositions = (
  nodes: Node[],
  positions: GraphLayoutResult["positions"],
): Node[] =>
  nodes.map((node) => {
    const position = positions[node.id];
    if (!position) return node;

    return {
      ...node,
      position,
    };
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
      },
    };
  });
