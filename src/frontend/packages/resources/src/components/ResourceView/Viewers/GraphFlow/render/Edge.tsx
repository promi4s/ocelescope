import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  type InternalNode,
  useInternalNode,
} from "@xyflow/react";
import { memo } from "react";
import type { GraphFlowEdgeType, GraphPoint } from "../model/types";
import { ArrowMarker, getMarkerIds } from "./edgeArrows";
import { EdgeEndLabel, EdgeLabel, endLabelPositions } from "./edgeLabels";

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

const getFallbackPath = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps<GraphFlowEdgeType>): EdgePathResult => {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return { path, labelX, labelY };
};

const resolveEdgePath = ({
  edge,
  sourceNode,
}: {
  edge: EdgeProps<GraphFlowEdgeType>;
  sourceNode: InternalNode | undefined;
}): EdgePathResult => {
  const { data, source, target } = edge;
  const customLabelPosition = fallbackLabelPosition(edge);

  if (data?.path) {
    return {
      path: data.path,
      labelX: data.labelPosition?.x ?? customLabelPosition.x,
      labelY: data.labelPosition?.y ?? customLabelPosition.y,
    };
  }

  if (source === target && sourceNode) return getSelfLoopPath(sourceNode);

  return getFallbackPath(edge);
};

const GraphFlowEdge = memo((props: EdgeProps<GraphFlowEdgeType>) => {
  const { id, source, data, sourceX, sourceY, targetX, targetY } = props;
  const sourceNode = useInternalNode(source);

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
  const edgePath = resolveEdgePath({ edge: props, sourceNode });
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
      {(data.start_label || data.end_label) &&
        (() => {
          const positions = endLabelPositions(startPos, endPos);
          return (
            <>
              {data.start_label && (
                <EdgeEndLabel
                  label={data.start_label}
                  x={positions.start.x}
                  y={positions.start.y}
                />
              )}
              {data.end_label && (
                <EdgeEndLabel
                  label={data.end_label}
                  x={positions.end.x}
                  y={positions.end.y}
                />
              )}
            </>
          );
        })()}
    </>
  );
});

GraphFlowEdge.displayName = "GraphFlowEdge";

export default GraphFlowEdge;
