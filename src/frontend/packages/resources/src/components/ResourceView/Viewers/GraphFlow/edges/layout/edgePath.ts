import {
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  type InternalNode,
} from "@xyflow/react";
import type { GraphPoint } from "../../pipeline/types";
import { getEdgeParams } from "../../utils/getEdgeParams";
import type { GraphFlowEdgeType } from "../types";

export type EdgePathResult = {
  path: string;
  labelX: number;
  labelY: number;
};

export const fallbackLabelPosition = ({
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

export const getSelfLoopPath = (sourceNode: InternalNode): EdgePathResult => {
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

export const getFloatingPath = ({
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

export const resolveEdgePath = ({
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

  if (source === target && sourceNode) {
    return getSelfLoopPath(sourceNode);
  }

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
