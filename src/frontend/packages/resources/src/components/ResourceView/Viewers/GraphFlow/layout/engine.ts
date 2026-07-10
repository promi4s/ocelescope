import {
  GraphError,
  type GraphModel,
  type GraphVisualization,
  type LayoutResult,
} from "../model/types";
import { ElkEngine } from "./elk";
import { GraphvizEngine } from "./graphviz";

// The black box. Everything downstream of `selectEngine` sees only this: hand it
// a model, get back geometry. No engine internals (spline conventions, y-flips,
// wasm loading, edge-id recovery) ever escape an implementation.
export interface LayoutEngine {
  run(model: GraphModel): Promise<LayoutResult>;
}

// The single place `layout_config` is read and validated. It maps the backend's
// layout choice onto a concrete engine; the rest of the pipeline is
// engine-agnostic.
export const selectEngine = (
  visualization: GraphVisualization,
): LayoutEngine => {
  const config = visualization.layout_config;

  switch (config?.type) {
    case "graphviz":
      if (!config.engine) {
        throw new GraphError("Invalid Graphviz layout config.", [
          "Missing Graphviz layout engine.",
        ]);
      }
      return new GraphvizEngine({
        engine: config.engine,
        graphAttrs: config.graphAttrs ?? {},
        nodeAttrs: config.nodeAttrs ?? {},
        edgeAttrs: config.edgeAttrs ?? {},
      });

    case "elk":
      return new ElkEngine({ options: config.options ?? {} });

    default:
      throw new GraphError("Invalid graph layout config.", [
        "Expected an ELK or Graphviz layout config from the backend.",
      ]);
  }
};
