import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  useInternalNode,
} from "@xyflow/react";
import { memo } from "react";
import { getEdgeParams } from "../util/getEdgeParams";

export type GraphFlowEdgeData = {
  color: string;
  label?: string | null;
  isVariable: boolean;
  path?: string | null;
  labelPosition?: { x: number; y: number } | null;
};

export type GraphFlowEdgeType = Edge<GraphFlowEdgeData, "graphflow">;

/** CSS id-safe string from a hex color — "#ff8800" → "ff8800" */
const colorToId = (color: string) => color.replace(/[^a-zA-Z0-9]/g, "");

const GraphFlowEdge = memo(
  ({
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
  }: EdgeProps<GraphFlowEdgeType>) => {
    const sourceNode = useInternalNode(source);
    const targetNode = useInternalNode(target);

    if (!data) return null;

    const color = data.color ?? "#555";
    const isVariable = data.isVariable ?? false;
    const markerId = `arrow-${colorToId(color)}`;

    const isSelfLoop = source === target;

    let edgePath: string;
    let labelX: number;
    let labelY: number;

    if (data.path) {
      edgePath = data.path;
      labelX = data.labelPosition?.x ?? (sourceX + targetX) / 2;
      labelY = data.labelPosition?.y ?? (sourceY + targetY) / 2;
    } else if (isSelfLoop && sourceNode) {
      const w = sourceNode.measured.width ?? 60;
      const h = sourceNode.measured.height ?? 34;
      const pos = sourceNode.internals.positionAbsolute;
      [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: pos.x + w,
        sourceY: pos.y + h * 0.25,
        sourcePosition: "right" as never,
        targetX: pos.x + w,
        targetY: pos.y + h * 0.75,
        targetPosition: "right" as never,
        borderRadius: 20,
        offset: 50,
      });
    } else {
      // Try floating border-to-border path; fall back to handle-based coords.
      const params =
        sourceNode && targetNode
          ? getEdgeParams(sourceNode, targetNode)
          : null;

      [edgePath, labelX, labelY] = getBezierPath(
        params
          ? {
              sourceX: params.sx,
              sourceY: params.sy,
              sourcePosition: params.sourcePos,
              targetX: params.tx,
              targetY: params.ty,
              targetPosition: params.targetPos,
            }
          : {
              sourceX,
              sourceY,
              sourcePosition,
              targetX,
              targetY,
              targetPosition,
            },
      );
    }

    return (
      <>
        {/* Per-color arrow marker rendered into the SVG defs layer */}
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

        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={`url(#${markerId})`}
          style={{
            stroke: color,
            strokeWidth: 1.5,
            strokeDasharray: isVariable ? "6 3" : undefined,
          }}
        />

        {data.label && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
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
              {data.label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

GraphFlowEdge.displayName = "GraphFlowEdge";

export default GraphFlowEdge;
