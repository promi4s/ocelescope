import type { GraphFlowModel, GraphLayoutPlan } from "../model/types";
import { GraphVisualizationError } from "../model/types";
import { ElkLayout } from "./ElkLayout";
import type { GraphLayout } from "./GraphLayout";
import { GraphvizLayout } from "./GraphvizLayout";

type PlanOf<T extends GraphLayoutPlan["type"]> = Extract<
  GraphLayoutPlan,
  { type: T }
>;
type ModelWithPlan<T extends GraphLayoutPlan["type"]> = GraphFlowModel & {
  layoutPlan: PlanOf<T>;
};

// Instantiates the layout strategy the backend chose for this graph. The cast
// is the one place a model is narrowed to a concrete plan — justified by the
// discriminant switch.
export const createLayout = (model: GraphFlowModel): GraphLayout => {
  switch (model.layoutPlan.type) {
    case "elk":
      return new ElkLayout(model as ModelWithPlan<"elk">);
    case "graphviz":
      return new GraphvizLayout(model as ModelWithPlan<"graphviz">);
    default:
      throw new GraphVisualizationError("Unsupported graph layout.", [
        "Expected an ELK or Graphviz layout config from the backend.",
      ]);
  }
};

export { applyLayout } from "./applyLayout";
export { GraphLayout } from "./GraphLayout";
