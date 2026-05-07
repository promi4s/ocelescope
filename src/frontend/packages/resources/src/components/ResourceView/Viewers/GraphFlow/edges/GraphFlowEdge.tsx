import { BaseEdge, type EdgeProps, useInternalNode } from "@xyflow/react";
import { memo } from "react";
import { EdgeEndLabel } from "./components/EdgeEndLabel";
import { EdgeLabel } from "./components/EdgeLabel";
import { EdgeMarkers, getMarkerIds } from "./components/EdgeMarkers";
import { resolveEdgePath } from "./layout/edgePath";
import type { GraphFlowEdgeType } from "./types";

const GraphFlowEdge = memo((props: EdgeProps<GraphFlowEdgeType>) => {
  const { id, source, target, data, sourceX, sourceY, targetX, targetY } =
    props;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!data) return null;

  const color = data.color ?? "#555";
  const dashed = data.dashed ?? false;
  const bold = data.bold ?? false;
  const startArrow = data.startArrow ?? null;
  const endArrow = data.endArrow ?? null;
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
      <EdgeMarkers
        color={color}
        startArrow={startArrow}
        endArrow={endArrow}
        startMarkerId={startMarkerId}
        endMarkerId={endMarkerId}
      />
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
