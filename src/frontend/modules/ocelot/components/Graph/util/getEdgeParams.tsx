import { type InternalNode, Position } from "@xyflow/react";

// Rectangle intersection helper
export const getRectangleIntersection = (
  targetNode: InternalNode,
  sourceNode: InternalNode,
) => {
  const { width = 0, height = 0 } = sourceNode.measured;
  const sourcePos = sourceNode.internals.positionAbsolute;
  const targetPos = targetNode.internals.positionAbsolute;

  const w = width / 2;
  const h = height / 2;

  const x2 = sourcePos.x + w;
  const y2 = sourcePos.y + h;
  const x1 = targetPos.x + (targetNode.measured.width ?? 0) / 2;
  const y1 = targetPos.y + (targetNode.measured.height ?? 0) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return {
    x: w * (xx3 + yy3) + x2,
    y: h * (-xx3 + yy3) + y2,
  };
};

// Circle intersection helper
export const getCircleIntersection = (
  source: InternalNode,
  target: InternalNode,
) => {
  const sourceX = source.internals.positionAbsolute.x;
  const sourceY = source.internals.positionAbsolute.y;
  const targetX = target.internals.positionAbsolute.x;
  const targetY = target.internals.positionAbsolute.y;

  const targetDiameter = target.measured.width ?? 0;
  const radius = targetDiameter / 2;

  const sourceCenterX = sourceX + (source.measured.width ?? 0) / 2;
  const sourceCenterY = sourceY + (source.measured.height ?? 0) / 2;

  const targetCenterX = targetX + radius;
  const targetCenterY = targetY + radius;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  const angle = Math.atan2(dy, dx);

  return {
    x: targetCenterX - Math.cos(angle) * radius,
    y: targetCenterY - Math.sin(angle) * radius,
  };
};

// Determine which function to use based on node types
function getIntersectionPoint(
  source: InternalNode,
  target: InternalNode,
): { x: number; y: number } {
  if (target.type === "circle") return getCircleIntersection(source, target);
  return getRectangleIntersection(source, target);
}

// Determine side of node the edge connects to
export const getEdgePosition = (
  node: InternalNode,
  point: { x: number; y: number },
): Position => {
  const n = { ...node.internals.positionAbsolute, ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + (node.measured.width ?? 0) - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + (node.measured.height ?? 0) - 1) return Position.Bottom;

  return Position.Top;
};

// Final exported utility
export function getEdgeParams(
  source: InternalNode,
  target: InternalNode,
): {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
} {
  const sourceIntersectionPoint = getIntersectionPoint(target, source);
  const targetIntersectionPoint = getIntersectionPoint(source, target);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}
