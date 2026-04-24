import { type InternalNode, Position } from "@xyflow/react";
import { PLACE_NODE_DIAMETER } from "../nodes/PlaceNode";

/** Center of a node in absolute coordinates. */
const center = (node: InternalNode) => {
  if (node.type === "place") {
    return {
      x: node.internals.positionAbsolute.x + PLACE_NODE_DIAMETER / 2,
      y: node.internals.positionAbsolute.y + PLACE_NODE_DIAMETER / 2,
    };
  }

  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
  };
};

/**
 * Point on `node`'s rectangular border heading toward `other`.
 * Uses the standard "diamond-normalised" formula so the result lies exactly
 * on the edge of the bounding box.
 */
const rectBorderPoint = (
  node: InternalNode,
  other: InternalNode,
): { x: number; y: number } | null => {
  const hw = (node.measured.width ?? 0) / 2;
  const hh = (node.measured.height ?? 0) / 2;
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

/**
 * Point on `node`'s circular border heading toward `other`.
 * Assumes the node is a square bounding box so radius = width/2.
 */
const circleBorderPoint = (
  node: InternalNode,
  other: InternalNode,
): { x: number; y: number } | null => {
  const radius = PLACE_NODE_DIAMETER / 2;
  if (radius === 0) return null;

  const nc = center(node);
  const oc = center(other);
  const angle = Math.atan2(oc.y - nc.y, oc.x - nc.x);
  return {
    x: nc.x + Math.cos(angle) * radius,
    y: nc.y + Math.sin(angle) * radius,
  };
};

/** Point on `node`'s border heading toward `other`. */
const borderPoint = (
  node: InternalNode,
  other: InternalNode,
): { x: number; y: number } | null =>
  node.type === "place"
    ? circleBorderPoint(node, other)
    : rectBorderPoint(node, other);

/** Which side of `node` is closest to `pt`. */
const edgeSide = (
  node: InternalNode,
  pt: { x: number; y: number },
): Position => {
  const nc = center(node);
  const dx = pt.x - nc.x;
  const dy = pt.y - nc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? Position.Right : Position.Left;
  }
  return dy >= 0 ? Position.Bottom : Position.Top;
};

export type EdgeParams = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
};

/**
 * Returns floating-edge attachment points on the borders of source and target.
 * Returns null if either node hasn't been measured yet (safe fallback to
 * handle-based coords in the calling component).
 */
export const getEdgeParams = (
  source: InternalNode,
  target: InternalNode,
): EdgeParams | null => {
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
