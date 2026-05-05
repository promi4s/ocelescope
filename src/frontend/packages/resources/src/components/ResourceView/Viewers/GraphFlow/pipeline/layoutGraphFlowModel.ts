import type { Edge, Node } from "@xyflow/react";
import { layoutWithElk } from "../layout/elk";
import type { GraphFlowModel, GraphLayoutResult } from "./types";

export const layoutGraphFlowModel = async ({
  model,
  measuredNodes,
  edges,
}: {
  model: GraphFlowModel;
  measuredNodes: Node[];
  edges: Edge[];
}): Promise<GraphLayoutResult | null> => {
  if (model.layoutPlan.type === "fixed-positions") {
    return null;
  }

  return layoutWithElk({
    nodes: measuredNodes,
    edges,
    layoutPlan: model.layoutPlan,
  });
};
