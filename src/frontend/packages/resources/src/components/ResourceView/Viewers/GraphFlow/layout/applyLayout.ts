import type {
  GraphFlowEdgeType,
  GraphFlowModel,
  GraphFlowNodeType,
  GraphLayoutResult,
} from "../model/types";

// Projects a computed layout back onto the React Flow render model: node
// positions and absolute edge paths. This is the single hand-off from
// "layout math" to "what React Flow draws".
export const applyLayout = (
  model: GraphFlowModel,
  result: GraphLayoutResult,
): { nodes: GraphFlowNodeType[]; edges: GraphFlowEdgeType[] } => ({
  nodes: model.nodes.map((node) => {
    const position = result.positions[node.id];
    return position ? { ...node, position } : node;
  }),
  edges: model.edges.map((edge) => {
    const layout = result.edgeLayouts[edge.id];
    if (!layout || !edge.data) return edge;
    return {
      ...edge,
      data: {
        ...edge.data,
        path: layout.path,
        labelPosition: layout.labelPosition ?? null,
        startPoint: layout.startPoint ?? null,
        endPoint: layout.endPoint ?? null,
      },
    };
  }),
});
