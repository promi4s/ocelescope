import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";
import { ELK_LAYOUT_OPTIONS } from "../constants/graphFlow";
import { rankdirToElkDirection } from "../utils/rankDirection";

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
  const direction = rankdirToElkDirection(
    visualization.layout_config?.direction ?? undefined,
  );

  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      ...ELK_LAYOUT_OPTIONS,
      "elk.direction": direction,
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
