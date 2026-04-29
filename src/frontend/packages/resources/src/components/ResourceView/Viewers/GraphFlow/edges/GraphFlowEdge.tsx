import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
  type InternalNode,
  getBezierPath,
  getSmoothStepPath,
  useInternalNode,
} from "@xyflow/react";
import { memo } from "react";
import { getEdgeParams } from "../utils/getEdgeParams";
import { colorToId } from "../utils/color";

export type GraphFlowEdgeData = {
  color: string;
  label?: string | null;
  isVariable: boolean;
  path?: string | null;
  labelPosition?: { x: number; y: number } | null;
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
}: Pick<EdgeProps<GraphFlowEdgeType>, "sourceX" | "sourceY" | "targetX" | "targetY">) => ({
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
  const params = sourceNode && targetNode ? getEdgeParams(sourceNode, targetNode) : null;
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

const EdgeMarker = ({ color, markerId }: { color: string; markerId: string }) => (
  <defs>
    <marker
      id={markerId}
      markerWidth="8"
      markerHeight="8"
      refX="7"
      refY="3"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L0,6 L8,3 z" fill={color} />
    </marker>
  </defs>
);

const EdgeLabel = ({
  color,
  label,
  x,
  y,
}: {
  color: string;
  label: string;
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
  const isVariable = data.isVariable ?? false;
  const markerId = `arrow-${colorToId(color)}`;
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

  return (
    <>
      <EdgeMarker color={color} markerId={markerId} />
      <BaseEdge
        id={id}
        path={edgePath.path}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: isVariable ? "6 3" : undefined,
        }}
      />
      {data.label && (
        <EdgeLabel
          color={color}
          label={data.label}
          x={edgePath.labelX}
          y={edgePath.labelY}
        />
      )}
    </>
  );
});

GraphFlowEdge.displayName = "GraphFlowEdge";

export default GraphFlowEdge;
