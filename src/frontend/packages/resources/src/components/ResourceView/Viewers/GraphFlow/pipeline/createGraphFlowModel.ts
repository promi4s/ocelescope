import { mapGraphVisualization } from "./mapGraphVisualization";
import type { GraphFlowModel, GraphVisualization } from "./types";

export const createGraphFlowModel = (
  visualization: GraphVisualization,
): GraphFlowModel => {
  return mapGraphVisualization(visualization);
};
