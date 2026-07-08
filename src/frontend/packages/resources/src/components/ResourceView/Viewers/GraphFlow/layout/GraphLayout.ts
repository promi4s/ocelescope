import type {
  GraphFlowModel,
  GraphLayoutPlan,
  GraphLayoutResult,
  GraphPoint,
} from "../model/types";
import { finalizeEdgeLayout } from "./edgePath";

// A single engine-produced edge route, before the shared fallback runs. `path`
// is null when the engine couldn't route the edge.
export type RoutedEdge = {
  path: string | null;
  labelPosition: GraphPoint | null;
  startPoint: GraphPoint | null;
  endPoint: GraphPoint | null;
};

// The raw output of an engine's `solve()`: where each node sits (top-left
// `position` for React Flow, `center` for edge fallbacks) and a best-effort
// route per edge id.
export type EnginePlacement = {
  positions: Record<string, GraphPoint>;
  centers: Record<string, GraphPoint>;
  edges: Record<string, RoutedEdge>;
};

// A layout strategy: given a graph model, place the nodes and route the edges.
// ELK and Graphviz are the two implementations. Subclasses only implement the
// engine-specific `solve()`; the shared `run()` turns their routes into final,
// always-readable edge layouts the same way for every engine.
export abstract class GraphLayout<
  Plan extends GraphLayoutPlan = GraphLayoutPlan,
> {
  constructor(
    protected readonly model: GraphFlowModel & { layoutPlan: Plan },
  ) {}

  protected get plan(): Plan {
    return this.model.layoutPlan;
  }

  // Template method. Every edge is finalized in one place: keep the routed path
  // when the engine produced one, else draw a straight line between the node
  // centers, else drop it so the renderer can fall back (e.g. self-loops).
  async run(): Promise<GraphLayoutResult> {
    const placement = await this.solve();
    const edgeLayouts: GraphLayoutResult["edgeLayouts"] = {};

    for (const edge of this.model.edges) {
      const routed = placement.edges[edge.id];
      const layout = finalizeEdgeLayout({
        path: routed?.path ?? null,
        labelPosition: routed?.labelPosition ?? null,
        startPoint: routed?.startPoint ?? null,
        endPoint: routed?.endPoint ?? null,
        sourceCenter: placement.centers[edge.source] ?? null,
        targetCenter: placement.centers[edge.target] ?? null,
      });
      if (layout) edgeLayouts[edge.id] = layout;
    }

    return { positions: placement.positions, edgeLayouts };
  }

  // Engine-specific: place nodes and produce best-effort edge routes keyed by
  // React Flow edge id.
  protected abstract solve(): Promise<EnginePlacement>;
}
