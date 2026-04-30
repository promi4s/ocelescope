import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";

const elk = new ELK();

// ─── Types ───────────────────────────────────────────────────────────────────

type ElkPoint = { x: number; y: number };
type ElkEdgeRouting = "SPLINES" | "ORTHOGONAL" | "POLYLINE";

type ElkEdgeSection = {
  startPoint?: ElkPoint;
  bendPoints?: ElkPoint[];
  endPoint?: ElkPoint;
};

type ElkEdgeLabel = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type ElkEdgeResult = {
  id?: string;
  sections?: ElkEdgeSection[];
  labels?: ElkEdgeLabel[];
  layoutOptions?: Record<string, unknown>;
};

type NodePositionMap = Record<string, { x: number; y: number }>;

export type ElkEdgeLayoutMap = Record<
  string,
  { path: string; labelPosition?: { x: number; y: number } | null }
>;

export type ElkLayoutResult = {
  positions: NodePositionMap;
  edgeLayouts: ElkEdgeLayoutMap;
};

// ─── Routing detection ───────────────────────────────────────────────────────

const normalizeEdgeRouting = (value: unknown): ElkEdgeRouting | null => {
  const s = typeof value === "string" ? value.toUpperCase() : null;
  if (s === "SPLINES") return "SPLINES";
  if (s === "ORTHOGONAL") return "ORTHOGONAL";
  if (s === "POLYLINE") return "POLYLINE";
  return null;
};

const getGraphEdgeRouting = (options: Record<string, unknown>): ElkEdgeRouting =>
  normalizeEdgeRouting(options["elk.edgeRouting"]) ??
  normalizeEdgeRouting(options["org.eclipse.elk.edgeRouting"]) ??
  "POLYLINE";

const getEdgeRouting = (edge: ElkEdgeResult, fallback: ElkEdgeRouting): ElkEdgeRouting => {
  const options = edge.layoutOptions ?? {};
  return (
    normalizeEdgeRouting(options["elk.edgeRouting"]) ??
    normalizeEdgeRouting(options["org.eclipse.elk.edgeRouting"]) ??
    fallback
  );
};

// ─── Path generation ─────────────────────────────────────────────────────────

// POLYLINE: straight line segments between waypoints
const toPolylinePath = (points: ElkPoint[]): string =>
  points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");

// ORTHOGONAL: straight segments with smooth rounded corners (quadratic bezier)
const toRoundedPath = (points: ElkPoint[], radius = 8): string => {
  if (points.length < 2) return "";
  if (points.length === 2)
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);

    if (len1 === 0 || len2 === 0) {
      path += ` L ${curr.x},${curr.y}`;
      continue;
    }

    const r = Math.min(radius, len1 / 2, len2 / 2);
    const inX = curr.x - (dx1 / len1) * r;
    const inY = curr.y - (dy1 / len1) * r;
    const outX = curr.x + (dx2 / len2) * r;
    const outY = curr.y + (dy2 / len2) * r;

    path += ` L ${inX},${inY} Q ${curr.x},${curr.y} ${outX},${outY}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x},${last.y}`;
  return path;
};

// SPLINES: smooth curve through ELK waypoints using midpoint corner-cutting.
// Uses each waypoint as a quadratic bezier control point with segment midpoints
// as anchors — avoids Catmull-Rom overshoots at sharp angles.
const toSplinePath = (points: ElkPoint[]): string | null => {
  if (points.length < 2) return null;
  if (points.length === 2)
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  const mid = (a: ElkPoint, b: ElkPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const first = points[0];
  const last = points[points.length - 1];
  const m01 = mid(points[0], points[1]);

  let path = `M ${first.x},${first.y} L ${m01.x},${m01.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1]);
    path += ` Q ${points[i].x},${points[i].y} ${m.x},${m.y}`;
  }

  path += ` L ${last.x},${last.y}`;
  return path;
};

const sectionToPath = (section: ElkEdgeSection, routing: ElkEdgeRouting): string | null => {
  if (!section.startPoint || !section.endPoint) return null;

  const points: ElkPoint[] = [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ];

  if (routing === "SPLINES") return toSplinePath(points);
  if (routing === "ORTHOGONAL") return toRoundedPath(points);
  return toPolylinePath(points);
};

const sectionMidpoint = (section: ElkEdgeSection): { x: number; y: number } | null => {
  if (!section.startPoint || !section.endPoint) return null;
  const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
  const mid = points[Math.floor(points.length / 2)];
  return mid ? { x: mid.x, y: mid.y } : null;
};

// ─── Map builders ────────────────────────────────────────────────────────────

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
  graphRouting: ElkEdgeRouting,
): ElkEdgeLayoutMap =>
  edges.reduce<ElkEdgeLayoutMap>((acc, edge) => {
    const section = edge.sections?.[0];
    if (!edge.id || !section) return acc;

    const routing = getEdgeRouting(edge, graphRouting);
    const path = sectionToPath(section, routing);
    if (!path) return acc;

    const label = edge.labels?.[0];
    const labelPosition =
      label?.x != null && label?.y != null
        ? { x: label.x + (label.width ?? 0) / 2, y: label.y + (label.height ?? 0) / 2 }
        : sectionMidpoint(section);

    acc[edge.id] = { path, labelPosition };
    return acc;
  }, {});

// ─── Main export ─────────────────────────────────────────────────────────────

export const layoutWithElk = async ({
  nodes,
  edges,
  visualization,
}: {
  nodes: Node[];
  edges: Edge[];
  visualization: VisualizationByType<"graph">;
}): Promise<ElkLayoutResult> => {
  const layoutOptions = (visualization.layout_config?.elk_options ?? {}) as Record<
    string,
    unknown
  >;
  const graphRouting = getGraphEdgeRouting(layoutOptions);

  const graph = await elk.layout({
    id: "root",
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: node.measured?.width ?? 50,
      height: node.measured?.height ?? 34,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      labels: edge.data?.label
        ? [
            {
              text: String(edge.data.label),
              width: String(edge.data.label).length * 7 + 12,
              height: 18,
            },
          ]
        : undefined,
    })),
  });

  return {
    positions: toPositionMap(graph.children),
    edgeLayouts: toEdgeLayoutMap(graph.edges as ElkEdgeResult[] | undefined, graphRouting),
  };
};
