import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  type InternalNode,
  useInternalNode,
} from "@xyflow/react";
import { memo } from "react";
import type { EdgeLayout, Point, RenderEdge } from "../model/types";
import { ArrowMarker, getMarkerIds } from "./edgeArrows";
import { EdgeEndLabel, EdgeLabel, endLabelPositions } from "./edgeLabels";

type ResolvedPath = { path: string; labelX: number; labelY: number };

const centerOf = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: Pick<
  EdgeProps<RenderEdge>,
  "sourceX" | "sourceY" | "targetX" | "targetY"
>): Point => ({
  x: (sourceX + targetX) / 2,
  y: (sourceY + targetY) / 2,
});

// Self-loop: a rounded route out of and back into the source node's right side.
const selfLoopPath = (sourceNode: InternalNode): ResolvedPath => {
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

const bezierFallback = (edge: EdgeProps<RenderEdge>): ResolvedPath => {
  const [path, labelX, labelY] = getBezierPath(edge);
  return { path, labelX, labelY };
};

// Prefer the absolute path computed by layout. Only when there is none do we
// fall back to a live-node self-loop or a straight bezier between handles.
const resolvePath = (
  edge: EdgeProps<RenderEdge>,
  layout: EdgeLayout | null,
  sourceNode: InternalNode | undefined,
): ResolvedPath => {
  if (layout?.path) {
    const center = centerOf(edge);
    return {
      path: layout.path,
      labelX: layout.labelPosition?.x ?? center.x,
      labelY: layout.labelPosition?.y ?? center.y,
    };
  }
  if (edge.source === edge.target && sourceNode)
    return selfLoopPath(sourceNode);
  return bezierFallback(edge);
};

const GraphFlowEdge = memo((props: EdgeProps<RenderEdge>) => {
  const { id, source, data, sourceX, sourceY, targetX, targetY } = props;
  const sourceNode = useInternalNode(source);

  if (!data) return null;
  const { model, layout } = data;

  const color = model.color ?? "#555";
  const dashed = model.style?.dashed ?? false;
  const bold = model.style?.bold ?? false;
  const startArrow = model.start_arrow ?? null;
  const endArrow = model.end_arrow ?? null;
  const { startMarkerId, endMarkerId } = getMarkerIds({
    color,
    startArrow,
    endArrow,
  });

  const resolved = resolvePath(props, layout, sourceNode);
  const startPos = layout?.startPoint ?? { x: sourceX, y: sourceY };
  const endPos = layout?.endPoint ?? { x: targetX, y: targetY };

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
        path={resolved.path}
        {...(endMarkerId ? { markerEnd: `url(#${endMarkerId})` } : {})}
        {...(startMarkerId ? { markerStart: `url(#${startMarkerId})` } : {})}
        style={{
          stroke: color,
          strokeWidth: bold ? 3 : 1.5,
          strokeDasharray: dashed ? "6 3" : undefined,
        }}
      />
      {(model.label || model.annotation) && (
        <EdgeLabel
          color={color}
          label={model.label}
          hasAnnotation={Boolean(model.annotation)}
          x={resolved.labelX}
          y={resolved.labelY}
        />
      )}
      {(model.start_label || model.end_label) &&
        (() => {
          const positions = endLabelPositions(startPos, endPos);
          return (
            <>
              {model.start_label && (
                <EdgeEndLabel
                  label={model.start_label}
                  x={positions.start.x}
                  y={positions.start.y}
                />
              )}
              {model.end_label && (
                <EdgeEndLabel
                  label={model.end_label}
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
