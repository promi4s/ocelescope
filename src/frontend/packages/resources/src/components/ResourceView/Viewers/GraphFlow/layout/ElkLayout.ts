import ELK from "elkjs/lib/elk.bundled.js";
import { normalizeEdgeRouting } from "../model/buildModel";
import type {
  ElkEdgeLabel,
  ElkEdgeResult,
  ElkEdgeSection,
  GraphEdgeRouting,
  GraphFlowEdgeType,
  GraphFlowNodeType,
  GraphLayoutPlan,
  GraphPoint,
} from "../model/types";
import { buildPolylinePath, buildSplinePath } from "./edgePath";
import {
  type EnginePlacement,
  GraphLayout,
  type RoutedEdge,
} from "./GraphLayout";

type ElkLayoutPlan = Extract<GraphLayoutPlan, { type: "elk" }>;

// ELK needs numeric node dimensions. The backend sets width/height on every
// built-in graph node, so these defaults only cover plugin nodes that leave a
// dimension unset (which would otherwise collapse to a zero-size box).
const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 40;

const nodeSize = (node: GraphFlowNodeType) => ({
  width: node.data.width ?? DEFAULT_NODE_WIDTH,
  height: node.data.height ?? DEFAULT_NODE_HEIGHT,
});

// Ordered geometry of a routed section: start anchor, bend points, end anchor.
const sectionPoints = (section: ElkEdgeSection): GraphPoint[] => {
  if (!section.startPoint || !section.endPoint) return [];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
};

// ELK SPLINES encode bend points as `(control, control, anchor)` triples that
// follow the start anchor; the final triple's anchor may be omitted, in which
// case it is the section end point. That is the same control-point convention
// the shared spline builder expects (`[startPoint, ...bendPoints]`). Anything
// else is drawn as a polyline through the section points.
const buildElkPath = (
  section: ElkEdgeSection,
  routing: GraphEdgeRouting,
): string | null => {
  const points = sectionPoints(section);
  if (points.length < 2) return null;

  if (routing === "SPLINES") {
    const splinePoints = [
      section.startPoint as GraphPoint,
      ...(section.bendPoints ?? []),
    ];
    if ((splinePoints.length - 1) % 3 === 2)
      splinePoints.push(section.endPoint as GraphPoint);
    const spline = buildSplinePath(splinePoints);
    if (spline) return spline;
  }

  return buildPolylinePath(points);
};

const sectionMidpoint = (section: ElkEdgeSection): GraphPoint | null => {
  const points = sectionPoints(section);
  const mid = points[Math.floor(points.length / 2)];
  return mid ? { x: mid.x, y: mid.y } : null;
};

const edgeLabelPosition = (
  label: ElkEdgeLabel | undefined,
  section: ElkEdgeSection,
): GraphPoint | null => {
  if (label?.x != null && label?.y != null) {
    return {
      x: label.x + (label.width ?? 0) / 2,
      y: label.y + (label.height ?? 0) / 2,
    };
  }
  return sectionMidpoint(section);
};

const edgeRoutingOf = (
  edge: ElkEdgeResult,
  fallback: GraphEdgeRouting,
): GraphEdgeRouting => {
  const options = edge.layoutOptions ?? {};
  const routing =
    options["elk.edgeRouting"] ?? options["org.eclipse.elk.edgeRouting"];
  return routing === undefined ? fallback : normalizeEdgeRouting(routing);
};

// Deterministic input order keeps ELK's output stable across renders.
const compareById = <T extends { id: string }>(left: T, right: T) =>
  left.id.localeCompare(right.id);

const compareEdgesForLayout = (
  left: GraphFlowEdgeType,
  right: GraphFlowEdgeType,
) =>
  left.source.localeCompare(right.source) ||
  left.target.localeCompare(right.target) ||
  left.id.localeCompare(right.id);

// ELK echoes each child's placement and (input) size, so we read both the
// top-left position React Flow needs and the center used for edge fallbacks.
const toNodeLayouts = (
  children: Array<{
    id?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }> = [],
): Pick<EnginePlacement, "positions" | "centers"> => {
  const positions: EnginePlacement["positions"] = {};
  const centers: EnginePlacement["centers"] = {};
  for (const child of children) {
    if (child.id && child.x != null && child.y != null) {
      const width = child.width ?? 0;
      const height = child.height ?? 0;
      positions[child.id] = { x: child.x, y: child.y };
      centers[child.id] = { x: child.x + width / 2, y: child.y + height / 2 };
    }
  }
  return { positions, centers };
};

// Sections are keyed by ELK edge id, which is the React Flow edge id we passed
// in — so the base class can match routes back to edges directly.
const toEdgeRoutes = (
  elkEdges: ElkEdgeResult[],
  graphRouting: GraphEdgeRouting,
): EnginePlacement["edges"] =>
  elkEdges.reduce<Record<string, RoutedEdge>>((acc, edge) => {
    const section = edge.sections?.[0];
    if (!edge.id || !section) return acc;
    acc[edge.id] = {
      path: buildElkPath(section, edgeRoutingOf(edge, graphRouting)),
      labelPosition: edgeLabelPosition(edge.labels?.[0], section),
      startPoint: section.startPoint ?? null,
      endPoint: section.endPoint ?? null,
    };
    return acc;
  }, {});

// Sizes come straight from the model (backend-authoritative), so ELK lays out
// purely from the model with no render-then-measure round trip.
export class ElkLayout extends GraphLayout<ElkLayoutPlan> {
  private static readonly elk = new ELK();

  protected async solve(): Promise<EnginePlacement> {
    const { nodes, edges } = this.model;

    const hasIntegerRanks = nodes.some(
      (node) => typeof node.data.rank === "number",
    );
    const mergedLayoutOptions: Record<string, string | number | boolean> =
      hasIntegerRanks
        ? { "elk.partitioning.activate": true, ...this.plan.elkOptions }
        : this.plan.elkOptions;

    const layoutNodes = [...nodes].sort(compareById);
    const layoutEdges = [...edges].sort(compareEdgesForLayout);

    const graph = await ElkLayout.elk.layout({
      id: "root",
      layoutOptions: mergedLayoutOptions as Record<string, string>,
      children: layoutNodes.map((node) => {
        const rank = node.data.rank ?? null;
        const layoutOptions: Record<string, string | number | boolean> = {
          ...(node.data.layout_attrs ?? {}),
        };

        if (rank === "source") {
          layoutOptions["elk.layered.layering.layerConstraint"] = "FIRST";
        } else if (rank === "sink") {
          layoutOptions["elk.layered.layering.layerConstraint"] = "LAST";
        } else if (typeof rank === "number") {
          layoutOptions["elk.partitioning.partition"] = String(rank);
        }

        const { width, height } = nodeSize(node);
        return {
          id: node.id,
          width,
          height,
          layoutOptions: layoutOptions as Record<string, string>,
        };
      }),
      edges: layoutEdges.map((edge) => {
        const edgeLabel = edge.data?.label;
        return {
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
          layoutOptions: (edge.data?.layout_attrs ?? {}) as Record<
            string,
            string
          >,
          ...(edgeLabel
            ? {
                labels: [
                  {
                    text: String(edgeLabel),
                    width: String(edgeLabel).length * 7 + 12,
                    height: 18,
                  },
                ],
              }
            : {}),
        };
      }),
    });

    const { positions, centers } = toNodeLayouts(graph.children);
    return {
      positions,
      centers,
      edges: toEdgeRoutes(
        (graph.edges as ElkEdgeResult[] | undefined) ?? [],
        this.plan.edgeRouting,
      ),
    };
  }
}
