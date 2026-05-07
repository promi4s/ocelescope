import type { Edge, Node } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { buildEdgePath } from "../paths/buildEdgePath";
import { getEdgeLabelPosition } from "../paths/edgeLabels";
import type {
  GraphEdgeRouting,
  GraphLayoutPlan,
  GraphLayoutResult,
} from "../pipeline/types";
import { normalizeEdgeRouting } from "../pipeline/validateGraphVisualization";
import { EXTERNAL_NODE_LABEL_HEIGHT } from "../constants/graphFlow";
import type { ElkEdgeResult } from "./elkTypes";

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

    const startPoint = section.startPoint
      ? { x: section.startPoint.x, y: section.startPoint.y }
      : null;
    const endPoint = section.endPoint
      ? { x: section.endPoint.x, y: section.endPoint.y }
      : null;

    acc[edge.id] = {
      path,
      labelPosition: getEdgeLabelPosition(edge.labels?.[0], section),
      startPoint,
      endPoint,
    };
    return acc;
  }, {});

const compareById = <T extends { id: string }>(left: T, right: T) =>
  left.id.localeCompare(right.id);

const compareEdgesForLayout = (left: Edge, right: Edge) =>
  left.source.localeCompare(right.source) ||
  left.target.localeCompare(right.target) ||
  left.id.localeCompare(right.id);

export const layoutWithElk = async ({
  nodes,
  edges,
  layoutPlan,
}: {
  nodes: Node[];
  edges: Edge[];
  layoutPlan: Extract<GraphLayoutPlan, { type: "elk" }>;
}): Promise<GraphLayoutResult> => {
  interface NodeDataExtras {
    label?: string | null;
    labelPos?: "top" | "center" | "bottom" | null;
    width?: number | null;
    height?: number | null;
    rank?: "source" | "sink" | number | null;
  }

  const hasIntegerRanks = nodes.some(
    (node) => typeof (node.data as NodeDataExtras).rank === "number",
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
      const nodeData = node.data as NodeDataExtras;
      const explicitWidth = nodeData.width ?? null;
      const explicitHeight = nodeData.height ?? null;
      const label = nodeData.label ?? null;
      const hasExternalLabel =
        Boolean(label) &&
        nodeData.labelPos !== "center" &&
        nodeData.labelPos != null;
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
