import { useReactFlow } from "@xyflow/react";
import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import { useCallback } from "react";
import type { GraphFlowEdgeType } from "../edges/types";
import type { GraphFlowNodeType } from "../nodes/types";
import type { GraphLayoutPlan } from "../pipeline/types";

const elk = new ELK();

const useElkLayout = ({
  elkOptions,
}: Extract<GraphLayoutPlan, { type: "elk" }>) => {
  const { getNodes, getEdges } = useReactFlow<
    GraphFlowNodeType,
    GraphFlowEdgeType
  >();

  const getLayoutedElements = useCallback(() => {
    const graph: ElkNode = {
      id: "root",
      children: getNodes().map((node) => ({
        ...node,
        ...(node.measured && {
          width: node.measured.width,
          height: node.measured.height,
        }),
      })),
      edges: getEdges().map((edge) => {
        return {
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
          ...(edge.data?.label
            ? {
                labels: [
                  {
                    text: String(edge.data.label),
                    width: String(edge.data.label).length * 7 + 12,
                    height: 18,
                  },
                ],
              }
            : {}),
        };
      }),
      layoutOptions: elkOptions as Record<string, string>,
    };

    elk.layout(graph).then((layout) => {});
  }, []);
};
