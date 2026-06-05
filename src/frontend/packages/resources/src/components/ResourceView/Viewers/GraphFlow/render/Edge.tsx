import type { GraphEdge, GraphNode } from "@ocelescope/api-base";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  type InternalNode,
  Position,
  useInternalNode,
} from "@xyflow/react";
import { memo } from "react";
import {
  EXTERNAL_NODE_LABEL_HEIGHT,
  type GraphFlowEdgeType,
  type GraphPoint,
} from "../model/types";

type EdgeArrow = GraphEdge["end_arrow"];
import { AnnotationBadge } from "./Node";

const placeBounds = (node: InternalNode) => {
  const data = node.data as unknown as GraphNode;
  const width = data.width ?? 0;
  const height = data.height ?? 0;
  const hasExternalTopLabel = Boolean(data.label) && data.label_pos === "top";

  return {
    x: node.internals.positionAbsolute.x,
    y:
      node.internals.positionAbsolute.y +
      (hasExternalTopLabel ? EXTERNAL_NODE_LABEL_HEIGHT : 0),
    width,
    height,
  };
};

const visualBounds = (node: InternalNode) => {
  if (node.type === "place") return placeBounds(node);
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  };
};

const center = (node: InternalNode) => {
  const bounds = visualBounds(node);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
};

const rectBorderPoint = (node: InternalNode, other: InternalNode) => {
  const bounds = visualBounds(node);
  const hw = bounds.width / 2;
  const hh = bounds.height / 2;
  if (hw === 0 || hh === 0) return null;

  const nc = center(node);
  const oc = center(other);
  const dx = oc.x - nc.x;
  const dy = oc.y - nc.y;

  const xx = dx / (2 * hw) - dy / (2 * hh);
  const yy = dx / (2 * hw) + dy / (2 * hh);
  const scale = 1 / (Math.abs(xx) + Math.abs(yy));
  if (!Number.isFinite(scale)) return null;

  return {
    x: nc.x + hw * scale * (xx + yy),
    y: nc.y + hh * scale * (-xx + yy),
  };
};

const circleBorderPoint = (node: InternalNode, other: InternalNode) => {
  const bounds = placeBounds(node);
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  if (rx === 0 || ry === 0) return null;

  const nc = center(node);
  const oc = center(other);
  const angle = Math.atan2(oc.y - nc.y, oc.x - nc.x);
  return { x: nc.x + Math.cos(angle) * rx, y: nc.y + Math.sin(angle) * ry };
};

const borderPoint = (node: InternalNode, other: InternalNode) =>
  node.type === "place"
    ? circleBorderPoint(node, other)
    : rectBorderPoint(node, other);

const edgeSide = (
  node: InternalNode,
  pt: { x: number; y: number },
): Position => {
  const nc = center(node);
  const dx = pt.x - nc.x;
  const dy = pt.y - nc.y;
  if (Math.abs(dx) >= Math.abs(dy))
    return dx >= 0 ? Position.Right : Position.Left;
  return dy >= 0 ? Position.Bottom : Position.Top;
};

const getEdgeParams = (source: InternalNode, target: InternalNode) => {
  const sp = borderPoint(source, target);
  const tp = borderPoint(target, source);
  if (!sp || !tp) return null;
  return {
    sx: sp.x,
    sy: sp.y,
    tx: tp.x,
    ty: tp.y,
    sourcePos: edgeSide(source, sp),
    targetPos: edgeSide(target, tp),
  };
};

type EdgePathResult = { path: string; labelX: number; labelY: number };

const fallbackLabelPosition = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: Pick<
  EdgeProps<GraphFlowEdgeType>,
  "sourceX" | "sourceY" | "targetX" | "targetY"
>): GraphPoint => ({
  x: (sourceX + targetX) / 2,
  y: (sourceY + targetY) / 2,
});

const getSelfLoopPath = (sourceNode: InternalNode): EdgePathResult => {
  const width = sourceNode.measured.width ?? 60;
  const height = sourceNode.measured.height ?? 34;
  const position = sourceNode.internals.positionAbsolute;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: position.x + width,
    sourceY: position.y + height * 0.25,
    sourcePosition: "right" as never,
    targetX: position.x + width,
    targetY: position.y + height * 0.75,
    targetPosition: "right" as never,
    borderRadius: 20,
    offset: 50,
  });
  return { path, labelX, labelY };
};

const getFloatingPath = ({
  sourceNode,
  targetNode,
  fallback,
}: {
  sourceNode: InternalNode | undefined;
  targetNode: InternalNode | undefined;
  fallback: Parameters<typeof getBezierPath>[0];
}): EdgePathResult => {
  const params =
    sourceNode && targetNode ? getEdgeParams(sourceNode, targetNode) : null;
  const [path, labelX, labelY] = getBezierPath(
    params
      ? {
          sourceX: params.sx,
          sourceY: params.sy,
          sourcePosition: params.sourcePos,
          targetX: params.tx,
          targetY: params.ty,
          targetPosition: params.targetPos,
        }
      : fallback,
  );
  return { path, labelX, labelY };
};

const resolveEdgePath = ({
  edge,
  sourceNode,
  targetNode,
}: {
  edge: EdgeProps<GraphFlowEdgeType>;
  sourceNode: InternalNode | undefined;
  targetNode: InternalNode | undefined;
}): EdgePathResult => {
  const { data, source, target, sourceX, sourceY, targetX, targetY } = edge;
  const customLabelPosition = fallbackLabelPosition(edge);

  if (data?.path) {
    return {
      path: data.path,
      labelX: data.labelPosition?.x ?? customLabelPosition.x,
      labelY: data.labelPosition?.y ?? customLabelPosition.y,
    };
  }

  if (source === target && sourceNode) return getSelfLoopPath(sourceNode);

  return getFloatingPath({
    sourceNode,
    targetNode,
    fallback: {
      sourceX,
      sourceY,
      sourcePosition: edge.sourcePosition,
      targetX,
      targetY,
      targetPosition: edge.targetPosition,
    },
  });
};

const colorToId = (color: string) => color.replace(/[^a-zA-Z0-9]/g, "");

type ArrowMarkerProps = {
  id: string;
  type: EdgeArrow;
  color: string;
  isStart: boolean;
};

const ArrowMarker = ({ id, type, color, isStart }: ArrowMarkerProps) => {
  if (!type) return null;
  const commonProps = {
    id,
    orient: isStart ? "auto-start-reverse" : "auto",
    markerUnits: "strokeWidth" as const,
  };

  switch (type) {
    case "triangle":
      return (
        <marker
          {...commonProps}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      );
    case "vee":
      return (
        <marker
          {...commonProps}
          markerWidth="8"
          markerHeight="6"
          refX="6"
          refY="3"
        >
          <path
            d="M0,0 L8,3 L0,6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
        </marker>
      );
    case "chevron":
      return (
        <marker
          {...commonProps}
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
        >
          <path
            d="M0,0 L5,3 L0,6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
        </marker>
      );
    case "tee":
      return (
        <marker
          {...commonProps}
          markerWidth="3"
          markerHeight="6"
          refX="1"
          refY="3"
        >
          <path d="M1,0 L1,6" stroke={color} strokeWidth="1.5" fill="none" />
        </marker>
      );
    case "circle":
      return (
        <marker
          {...commonProps}
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
        >
          <circle cx="3" cy="3" r="2.5" fill={color} />
        </marker>
      );
    case "circle-triangle":
      return (
        <marker
          {...commonProps}
          markerWidth="13"
          markerHeight="6"
          refX="12"
          refY="3"
        >
          <circle cx="2.5" cy="3" r="2.5" fill={color} />
          <path d="M5,0 L5,6 L13,3 z" fill={color} />
        </marker>
      );
    case "triangle-backcurve":
      return (
        <marker
          {...commonProps}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
        >
          <path d="M0,0 Q4,3 0,6 L8,3 z" fill={color} />
        </marker>
      );
    case "triangle-tee":
      return (
        <marker
          {...commonProps}
          markerWidth="11"
          markerHeight="6"
          refX="10"
          refY="3"
        >
          <path d="M0,0 L0,6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M2,0 L2,6 L10,3 z" fill={color} />
        </marker>
      );
    case "triangle-cross":
      return (
        <marker
          {...commonProps}
          markerWidth="11"
          markerHeight="6"
          refX="10"
          refY="3"
        >
          <path
            d="M0,0 L4,6 M4,0 L0,6"
            stroke={color}
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M5,0 L5,6 L11,3 z" fill={color} />
        </marker>
      );
    case "square":
      return (
        <marker
          {...commonProps}
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
        >
          <rect x="0" y="0" width="6" height="6" fill={color} />
        </marker>
      );
    case "diamond":
      return (
        <marker
          {...commonProps}
          markerWidth="9"
          markerHeight="6"
          refX="8"
          refY="3"
        >
          <path d="M0,3 L4,0 L8,3 L4,6 z" fill={color} />
        </marker>
      );
    default:
      return null;
  }
};

const getMarkerIds = ({
  color,
  startArrow,
  endArrow,
}: {
  color: string;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
}) => {
  const colorKey = colorToId(color);
  return {
    startMarkerId: startArrow ? `arrow-start-${startArrow}-${colorKey}` : null,
    endMarkerId: endArrow ? `arrow-end-${endArrow}-${colorKey}` : null,
  };
};

// ─── Edge labels ──────────────────────────────────────────────────────────────

const EdgeLabel = ({
  color,
  label,
  hasAnnotation,
  x,
  y,
}: {
  color: string;
  label?: string | null | undefined;
  hasAnnotation: boolean;
  x: number;
  y: number;
}) => (
  <EdgeLabelRenderer>
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: "all",
        backgroundColor: color,
        color: "#ffffff",
        fontSize: 11,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontWeight: 500,
        padding: "2px 6px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
      className="nodrag nopan"
    >
      {label}
      {hasAnnotation && <AnnotationBadge />}
    </div>
  </EdgeLabelRenderer>
);

const EdgeEndLabel = ({
  label,
  x,
  y,
  offsetX,
  offsetY,
}: {
  label: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}) => (
  <EdgeLabelRenderer>
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x + offsetX}px, ${y + offsetY}px)`,
        pointerEvents: "none",
        color: "#444",
        fontSize: 10,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
      className="nodrag nopan"
    >
      {label}
    </div>
  </EdgeLabelRenderer>
);

// ─── Edge ─────────────────────────────────────────────────────────────────────

const GraphFlowEdge = memo((props: EdgeProps<GraphFlowEdgeType>) => {
  const { id, source, target, data, sourceX, sourceY, targetX, targetY } =
    props;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!data) return null;

  const color = data.color ?? "#555";
  const dashed = data.style?.dashed ?? false;
  const bold = data.style?.bold ?? false;
  const startArrow = data.start_arrow ?? null;
  const endArrow = data.end_arrow ?? null;
  const { startMarkerId, endMarkerId } = getMarkerIds({
    color,
    startArrow,
    endArrow,
  });
  const edgePath = resolveEdgePath({ edge: props, sourceNode, targetNode });
  const startPos = data.startPoint ?? { x: sourceX, y: sourceY };
  const endPos = data.endPoint ?? { x: targetX, y: targetY };

  return (
    <>
      <defs>
        {endMarkerId && (
          <ArrowMarker
            id={endMarkerId}
            type={endArrow}
            color={color}
            isStart={false}
          />
        )}
        {startMarkerId && (
          <ArrowMarker
            id={startMarkerId}
            type={startArrow}
            color={color}
            isStart
          />
        )}
      </defs>
      <BaseEdge
        id={id}
        path={edgePath.path}
        {...(endMarkerId ? { markerEnd: `url(#${endMarkerId})` } : {})}
        {...(startMarkerId ? { markerStart: `url(#${startMarkerId})` } : {})}
        style={{
          stroke: color,
          strokeWidth: bold ? 3 : 1.5,
          strokeDasharray: dashed ? "6 3" : undefined,
        }}
      />
      {(data.label || data.annotation) && (
        <EdgeLabel
          color={color}
          label={data.label}
          hasAnnotation={Boolean(data.annotation)}
          x={edgePath.labelX}
          y={edgePath.labelY}
        />
      )}
      {data.start_label && (
        <EdgeEndLabel
          label={data.start_label}
          x={startPos.x}
          y={startPos.y}
          offsetX={8}
          offsetY={-10}
        />
      )}
      {data.end_label && (
        <EdgeEndLabel
          label={data.end_label}
          x={endPos.x}
          y={endPos.y}
          offsetX={8}
          offsetY={-10}
        />
      )}
    </>
  );
});

GraphFlowEdge.displayName = "GraphFlowEdge";

export default GraphFlowEdge;
