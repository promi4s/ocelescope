import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";
import { ELK_LAYOUT_OPTIONS } from "../constants/graphFlow";

const elk = new ELK();

type NodePositionMap = Record<string, { x: number; y: number }>;

const toPositionMap = (children: Array<{ id?: string; x?: number; y?: number }> = []): NodePositionMap =>
  children.reduce<NodePositionMap>((positions, child) => {
    if (child.id && child.x != null && child.y != null) {
      positions[child.id] = { x: child.x, y: child.y };
    }
    return positions;
  }, {});

export const layoutWithElk = async ({
  nodes,
  edges,
  visualization,
}: {
  nodes: Node[];
  edges: Edge[];
  visualization: VisualizationByType<"graph">;
}): Promise<NodePositionMap> => {
  const direction = visualization.layout_config?.direction ?? "DOWN";

  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      ...ELK_LAYOUT_OPTIONS,
      "elk.direction": direction,
      ...(visualization.layout_config?.algorithm != null && {
        "elk.algorithm": visualization.layout_config.algorithm,
      }),
      ...(visualization.layout_config?.edge_routing != null && {
        "elk.edgeRouting": visualization.layout_config.edge_routing,
      }),
      ...(visualization.layout_config?.node_spacing != null && {
        "elk.spacing.nodeNode": String(visualization.layout_config.node_spacing),
      }),
      ...(visualization.layout_config?.layer_spacing != null && {
        "elk.layered.spacing.nodeNodeBetweenLayers": String(visualization.layout_config.layer_spacing),
      }),
      ...(visualization.layout_config?.edge_edge_spacing != null && {
        "elk.spacing.edgeEdge": String(visualization.layout_config.edge_edge_spacing),
      }),
      ...(visualization.layout_config?.edge_node_spacing != null && {
        "elk.spacing.edgeNode": String(visualization.layout_config.edge_node_spacing),
      }),
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.measured?.width ?? 50,
      height: node.measured?.height ?? 34,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });

  return toPositionMap(graph.children);
};
