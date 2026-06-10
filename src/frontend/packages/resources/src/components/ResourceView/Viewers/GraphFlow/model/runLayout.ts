import type { GraphNode } from "@ocelescope/api-base";
import type { Edge, Node } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { normalizeEdgeRouting } from "./buildModel";
import {
  type ElkEdgeLabel,
  type ElkEdgeResult,
  type ElkEdgeSection,
  type ElkPoint,
  EXTERNAL_NODE_LABEL_HEIGHT,
  type GraphEdgeRouting,
  type GraphFlowModel,
  type GraphLayoutPlan,
  type GraphLayoutResult,
  type GraphPoint,
  GraphVisualizationError,
} from "./types";

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

type NodePositionMap = GraphLayoutResult["positions"];
type ElkEdgeLayoutMap = GraphLayoutResult["edgeLayouts"];

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
): NodePositionMap =>
  children.reduce<NodePositionMap>((acc, child) => {
    if (child.id && child.x != null && child.y != null)
      acc[child.id] = { x: child.x, y: child.y };
    return acc;
  }, {});

const toEdgeLayoutMap = (
  edges: ElkEdgeResult[] = [],
  graphRouting: GraphEdgeRouting,
): ElkEdgeLayoutMap =>
  edges.reduce<ElkEdgeLayoutMap>((acc, edge) => {
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

const layoutWithElk = async ({
  nodes,
  edges,
  layoutPlan,
}: {
  nodes: Node[];
  edges: Edge[];
  layoutPlan: Extract<GraphLayoutPlan, { type: "elk" }>;
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
      const explicitWidth = nodeData.width ?? null;
      const explicitHeight = nodeData.height ?? null;
      const label = nodeData.label ?? null;
      const hasExternalLabel =
        Boolean(label) &&
        nodeData.label_pos !== "center" &&
        nodeData.label_pos != null;
      const rank = nodeData.rank ?? null;

      const nodeLayoutOptions: Record<string, string> = {};
      if (rank === "source") {
        nodeLayoutOptions["elk.layered.layering.layerConstraint"] = "FIRST";
      } else if (rank === "sink") {
        nodeLayoutOptions["elk.layered.layering.layerConstraint"] = "LAST";
      } else if (typeof rank === "number") {
        nodeLayoutOptions["elk.partitioning.partition"] = String(rank);
      }

      return {
        id: node.id,
        width: explicitWidth as number,
        height:
          (explicitHeight as number) +
          (hasExternalLabel ? EXTERNAL_NODE_LABEL_HEIGHT * 2 : 0),
        layoutOptions: nodeLayoutOptions,
      };
    }),
    edges: layoutEdges.map((edge) => {
      const edgeLabel = (edge.data as { label?: string | null } | undefined)
        ?.label;
      return {
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
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

export const toGraphError = (error: unknown): GraphVisualizationError => {
  if (error instanceof GraphVisualizationError) return error;
  return new GraphVisualizationError("Graph layout failed.", [
    error instanceof Error ? error.message : String(error),
  ]);
};

export const measuredNodesMatchModel = (
  measuredNodes: Node[],
  model: GraphFlowModel,
) => {
  if (measuredNodes.length !== model.nodes.length) return false;
  const measuredNodeIds = new Set(measuredNodes.map((node) => node.id));
  return model.nodes.every((node) => measuredNodeIds.has(node.id));
};

const applyNodePositions = (
  nodes: Node[],
  positions: GraphLayoutResult["positions"],
): Node[] =>
  nodes.map((node) => {
    const position = positions[node.id];
    return position ? { ...node, position } : node;
  });

const applyEdgeLayouts = (
  edges: Edge[],
  edgeLayouts: GraphLayoutResult["edgeLayouts"],
): Edge[] =>
  edges.map((edge) => {
    const layout = edgeLayouts[edge.id];
    if (!layout) return edge;
    return {
      ...edge,
      data: {
        ...edge.data,
        path: layout.path,
        labelPosition: layout.labelPosition,
        startPoint: layout.startPoint,
        endPoint: layout.endPoint,
      },
    };
  });

export const composeGraphLayout = async ({
  model,
  measuredNodes,
  edges,
}: {
  model: GraphFlowModel;
  measuredNodes: Node[];
  edges: Edge[];
}) => {
  if (model.nodes.length === 0) return { nodes: measuredNodes, edges };
  if (!measuredNodesMatchModel(measuredNodes, model)) return null;
  if (model.layoutPlan.type === "fixed-positions") {
    return { nodes: measuredNodes, edges };
  }

  const layout = await layoutWithElk({
    nodes: measuredNodes,
    edges,
    layoutPlan: model.layoutPlan,
  });

  return {
    nodes: applyNodePositions(measuredNodes, layout.positions),
    edges: applyEdgeLayouts(edges, layout.edgeLayouts),
  };
};
