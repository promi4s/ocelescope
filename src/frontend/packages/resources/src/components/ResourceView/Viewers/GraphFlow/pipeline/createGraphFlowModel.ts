import { mapGraphVisualization } from "./mapGraphVisualization";
import type { GraphFlowModel, GraphVisualization } from "./types";
import { validateGraphVisualization } from "./validateGraphVisualization";

export const createGraphFlowModel = (
  visualization: GraphVisualization,
): GraphFlowModel => {
  validateGraphVisualization(visualization);
  return mapGraphVisualization(visualization);
};
