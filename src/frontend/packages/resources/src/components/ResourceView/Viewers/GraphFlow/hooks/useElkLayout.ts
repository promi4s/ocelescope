import type { GraphNode } from "@ocelescope/api-base";
import {
  type Edge,
  type Node,
  useNodes,
  useNodesInitialized,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { useCallback } from "react";
import { normalizeEdgeRouting } from "../model/buildModel";
import {
  applyEdgeLayouts,
  applyNodePositions,
  measuredNodesMatchModel,
} from "../model/runLayout";
import type {
  ElkEdgeLabel,
  ElkEdgeResult,
  ElkEdgeSection,
  ElkPoint,
  GraphEdgeRouting,
  GraphFlowModel,
  GraphLayoutPlan,
  GraphLayoutResult,
  GraphPoint,
} from "../model/types";

type ElkLayoutPlan = Extract<GraphLayoutPlan, { type: "elk" }>;
export type ElkGraphFlowModel = Omit<GraphFlowModel, "layoutPlan"> & {
  layoutPlan: ElkLayoutPlan;
};

const buildPolylinePath = (points: ElkPoint[]): string | null => {
  if (points.length < 2) return null;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
    .join(" ");
};

// ELK SPLINES bend points are control points for a piecewise cubic spline.
// See: https://eclipse.dev/elk/reference/options/org-eclipse-elk-edgeRouting.html
const buildSplinePath = (section: ElkEdgeSection): string | null => {
  const start = section.startPoint;
  const end = section.endPoint;
  if (!start || !end) return null;

  const bendPoints = section.bendPoints ?? [];
  if (bendPoints.length === 0) {
    return `M ${start.x},${start.y} L ${end.x},${end.y}`;
  }

  let path = `M ${start.x},${start.y}`;
  for (let index = 0; index < bendPoints.length; index += 3) {
    const cp1 = bendPoints[index];
    const cp2 = bendPoints[index + 1];
    if (!cp1 || !cp2) return null;

    const anchor = bendPoints[index + 2] ?? end;
    path += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${anchor.x},${anchor.y}`;
  }
  return path;
};

const buildEdgePath = (
  section: ElkEdgeSection,
  routing: GraphEdgeRouting,
): string | null => {
  if (routing === "SPLINES") return buildSplinePath(section);

  const start = section.startPoint;
  const end = section.endPoint;
  if (!start || !end) return null;

  return buildPolylinePath([start, ...(section.bendPoints ?? []), end]);
};

const sectionMidpoint = (section: ElkEdgeSection): GraphPoint | null => {
  if (!section.startPoint || !section.endPoint) return null;
  const points = [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ];
  const mid = points[Math.floor(points.length / 2)];
  return mid ? { x: mid.x, y: mid.y } : null;
};

const getEdgeLabelPosition = (
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

const elk = new ELK();

const getEdgeRouting = (
  edge: ElkEdgeResult,
  fallback: GraphEdgeRouting,
): GraphEdgeRouting => {
  const options = edge.layoutOptions ?? {};
  const edgeRouting =
    options["elk.edgeRouting"] ?? options["org.eclipse.elk.edgeRouting"];
  return edgeRouting === undefined
    ? fallback
    : normalizeEdgeRouting(edgeRouting);
};

const toPositionMap = (
  children: Array<{ id?: string; x?: number; y?: number }> = [],
): GraphLayoutResult["positions"] =>
  children.reduce<GraphLayoutResult["positions"]>((acc, child) => {
    if (child.id && child.x != null && child.y != null)
      acc[child.id] = { x: child.x, y: child.y };
    return acc;
  }, {});

const toEdgeLayoutMap = (
  edges: ElkEdgeResult[] = [],
  graphRouting: GraphEdgeRouting,
): GraphLayoutResult["edgeLayouts"] =>
  edges.reduce<GraphLayoutResult["edgeLayouts"]>((acc, edge) => {
    const section = edge.sections?.[0];
    if (!edge.id || !section) return acc;

    const routing = getEdgeRouting(edge, graphRouting);
    const path = buildEdgePath(section, routing);
    if (!path) return acc;

    acc[edge.id] = {
      path,
      labelPosition: getEdgeLabelPosition(edge.labels?.[0], section),
      startPoint: section.startPoint
        ? { x: section.startPoint.x, y: section.startPoint.y }
        : null,
      endPoint: section.endPoint
        ? { x: section.endPoint.x, y: section.endPoint.y }
        : null,
    };
    return acc;
  }, {});

const compareById = <T extends { id: string }>(left: T, right: T) =>
  left.id.localeCompare(right.id);

const compareEdgesForLayout = (left: Edge, right: Edge) =>
  left.source.localeCompare(right.source) ||
  left.target.localeCompare(right.target) ||
  left.id.localeCompare(right.id);

const runElk = async ({
  nodes,
  edges,
  layoutPlan,
}: {
  nodes: Node[];
  edges: Edge[];
  layoutPlan: ElkLayoutPlan;
}): Promise<GraphLayoutResult> => {
  const hasIntegerRanks = nodes.some(
    (node) => typeof (node.data as unknown as GraphNode).rank === "number",
  );
  const mergedLayoutOptions: Record<string, string | number | boolean> =
    hasIntegerRanks
      ? { "elk.partitioning.activate": true, ...layoutPlan.elkOptions }
      : layoutPlan.elkOptions;
  const layoutNodes = [...nodes].sort(compareById);
  const layoutEdges = [...edges].sort(compareEdgesForLayout);

  const graph = await elk.layout({
    id: "root",
    layoutOptions: mergedLayoutOptions as Record<string, string>,
    children: layoutNodes.map((node) => {
      const nodeData = node.data as unknown as GraphNode;
      const rank = nodeData.rank ?? null;
      const layoutOptions: Record<string, string | number | boolean> = {
        ...(nodeData.layout_attrs ?? {}),
      };

      if (rank === "source") {
        layoutOptions["elk.layered.layering.layerConstraint"] = "FIRST";
      } else if (rank === "sink") {
        layoutOptions["elk.layered.layering.layerConstraint"] = "LAST";
      } else if (typeof rank === "number") {
        layoutOptions["elk.partitioning.partition"] = String(rank);
      }

      return {
        id: node.id,
        width: nodeData.width as number,
        height: nodeData.height as number,
        layoutOptions: layoutOptions as Record<string, string>,
      };
    }),
    edges: layoutEdges.map((edge) => {
      const edgeData = edge.data as
        | {
            label?: string | null;
            layout_attrs?: Record<string, string | number | boolean> | null;
          }
        | undefined;
      const edgeLabel = edgeData?.label;

      return {
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
        layoutOptions: (edgeData?.layout_attrs ?? {}) as Record<string, string>,
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

  return {
    positions: toPositionMap(graph.children),
    edgeLayouts: toEdgeLayoutMap(
      graph.edges as ElkEdgeResult[] | undefined,
      layoutPlan.edgeRouting,
    ),
  };
};

export const useElkLayout = () => {
  const measuredNodes = useNodes();
  const nodesInitialized = useNodesInitialized();

  return useCallback(
    async (model: ElkGraphFlowModel) => {
      if (!nodesInitialized || !measuredNodesMatchModel(measuredNodes, model)) {
        return null;
      }

      const layout = await runElk({
        nodes: measuredNodes,
        edges: model.edges,
        layoutPlan: model.layoutPlan,
      });

      return {
        nodes: applyNodePositions(measuredNodes, layout.positions),
        edges: applyEdgeLayouts(model.edges, layout.edgeLayouts),
      };
    },
    [nodesInitialized, measuredNodes],
  );
};
