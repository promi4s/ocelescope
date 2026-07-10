import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  type EdgeLayout,
  type EdgeRoute,
  type GraphModel,
  type LayoutResult,
  type ModelNode,
  type Point,
  type RenderEdge,
  type RenderNode,
} from "../model/types";
import { isDegenerate, routeToPath, straightEdgeLayout } from "./routeToPath";

// The single hand-off from "layout geometry" to "what React Flow draws". It
// takes the model plus a `LayoutResult` and produces positioned React Flow
// nodes and edges with absolute paths. This is the only step that knows both
// the domain model and the render model; the renderer downstream reads its
// output and nothing else.
export const projectToRenderModel = (
  model: GraphModel,
  layout: LayoutResult,
): { nodes: RenderNode[]; edges: RenderEdge[] } => {
  const centers = nodeCenters(model.nodes, layout.positions);

  const nodes: RenderNode[] = model.nodes.map((node) => ({
    id: node.id,
    type: "node",
    position: layout.positions[node.id] ?? { x: node.x ?? 0, y: node.y ?? 0 },
    data: { model: node },
  }));

  const edges: RenderEdge[] = model.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "graphflow",
    data: {
      model: edge,
      layout: finalizeEdge(
        layout.routes[edge.id],
        centers[edge.source],
        centers[edge.target],
      ),
    },
  }));

  return { nodes, edges };
};

const sizeOf = (node: ModelNode) => ({
  width: node.width ?? DEFAULT_NODE_WIDTH,
  height: node.height ?? DEFAULT_NODE_HEIGHT,
});

// Node centers, derived from top-left positions plus (backend-authoritative)
// sizes. Used only for the straight-line edge fallback — the engines never need
// to report centers, keeping the layout contract to positions + routes.
const nodeCenters = (
  nodes: ModelNode[],
  positions: Record<string, Point>,
): Record<string, Point> => {
  const centers: Record<string, Point> = {};
  for (const node of nodes) {
    const position = positions[node.id];
    if (!position) continue;
    const { width, height } = sizeOf(node);
    centers[node.id] = {
      x: position.x + width / 2,
      y: position.y + height / 2,
    };
  }
  return centers;
};

// Every edge is resolved in one place: keep the engine's routed path if it
// produced one, else draw a straight line between node centers, else leave it
// `null` so the edge renderer draws its own last resort (self-loop / bezier).
const finalizeEdge = (
  route: EdgeRoute | undefined,
  sourceCenter: Point | undefined,
  targetCenter: Point | undefined,
): EdgeLayout | null => {
  if (route) {
    const layout = routeToEdgeLayout(route);
    if (layout) return layout;
  }
  if (
    sourceCenter &&
    targetCenter &&
    !isDegenerate(sourceCenter, targetCenter)
  ) {
    return straightEdgeLayout(sourceCenter, targetCenter);
  }
  return null;
};

const routeToEdgeLayout = (route: EdgeRoute): EdgeLayout | null => {
  const path = routeToPath(route);
  if (!path) return null;
  return {
    path,
    startPoint: route.startAnchor ?? route.points[0] ?? null,
    endPoint: route.endAnchor ?? route.points.at(-1) ?? null,
    labelPosition: route.labelPosition,
  };
};
