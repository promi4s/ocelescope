import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  type InternalNode,
  useInternalNode,
} from "@xyflow/react";
import { memo } from "react";
import { AnnotationBadge } from "../components/AnnotationBadge";
import { colorToId } from "../utils/color";
import { getEdgeParams } from "../utils/getEdgeParams";

type EdgeArrow =
  | "triangle"
  | "circle-triangle"
  | "triangle-backcurve"
  | "tee"
  | "circle"
  | "chevron"
  | "triangle-tee"
  | "triangle-cross"
  | "vee"
  | "square"
  | "diamond"
  | null;

export type GraphFlowEdgeData = {
  color: string;
  label?: string | null;
  dashed: boolean;
  startArrow?: EdgeArrow;
  endArrow?: EdgeArrow;
  startLabel?: string | null;
  endLabel?: string | null;
  annotation?: { type?: string } | null;
  path?: string | null;
  labelPosition?: { x: number; y: number } | null;
  startPoint?: { x: number; y: number } | null;
  endPoint?: { x: number; y: number } | null;
};

export type GraphFlowEdgeType = Edge<GraphFlowEdgeData, "graphflow">;

type EdgePathResult = {
  path: string;
  labelX: number;
  labelY: number;
};

const fallbackLabelPosition = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: Pick<
  EdgeProps<GraphFlowEdgeType>,
  "sourceX" | "sourceY" | "targetX" | "targetY"
>) => ({
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

const ArrowMarker = ({
  id,
  type,
  color,
  isStart,
}: {
  id: string;
  type: EdgeArrow;
  color: string;
  isStart: boolean;
}) => {
  if (!type) return null;
  const orient = isStart ? "auto-start-reverse" : "auto";

  const commonProps = {
    id,
    orient,
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

const GraphFlowEdge = memo((props: EdgeProps<GraphFlowEdgeType>) => {
  const {
    id,
    source,
    target,
    data,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  } = props;

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!data) return null;

  const color = data.color ?? "#555";
  const dashed = data.dashed ?? false;
  const startArrow = data.startArrow ?? null;
  const endArrow = data.endArrow ?? null;

  const colorKey = colorToId(color);
  const endMarkerId = endArrow ? `arrow-end-${endArrow}-${colorKey}` : null;
  const startMarkerId = startArrow
    ? `arrow-start-${startArrow}-${colorKey}`
    : null;

  const customLabelPosition = fallbackLabelPosition(props);

  const edgePath = (() => {
    if (data.path) {
      return {
        path: data.path,
        labelX: data.labelPosition?.x ?? customLabelPosition.x,
        labelY: data.labelPosition?.y ?? customLabelPosition.y,
      };
    }

    if (source === target && sourceNode) {
      return getSelfLoopPath(sourceNode);
    }

    return getFloatingPath({
      sourceNode,
      targetNode,
      fallback: {
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      },
    });
  })();

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
            isStart={true}
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
          strokeWidth: 1.5,
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
      {data.startLabel && (
        <EdgeEndLabel
          label={data.startLabel}
          x={startPos.x}
          y={startPos.y}
          offsetX={8}
          offsetY={-10}
        />
      )}
      {data.endLabel && (
        <EdgeEndLabel
          label={data.endLabel}
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
