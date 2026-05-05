import { type InternalNode, Position } from "@xyflow/react";

type VisualNodeData = {
  width?: number | null;
  height?: number | null;
  label?: string | null;
  labelPos?: "top" | "center" | "bottom" | null;
};

const placeBounds = (node: InternalNode) => {
  const data = node.data as VisualNodeData;
  const width = data.width ?? 0;
  const height = data.height ?? 0;
  const hasExternalTopLabel = Boolean(data.label) && data.labelPos === "top";

  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y + (hasExternalTopLabel ? 22 : 0),
    width,
    height,
  };
};

const visualBounds = (node: InternalNode) => {
  if (node.type === "place") {
    return placeBounds(node);
  }

  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  };
};

/** Center of a node in absolute coordinates. */
const center = (node: InternalNode) => {
  const bounds = visualBounds(node);

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
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

/**
 * Point on `node`'s elliptical border heading toward `other`.
 */
const circleBorderPoint = (
  node: InternalNode,
  other: InternalNode,
): { x: number; y: number } | null => {
  const bounds = placeBounds(node);
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  if (rx === 0 || ry === 0) return null;

  const nc = center(node);
  const oc = center(other);
  const angle = Math.atan2(oc.y - nc.y, oc.x - nc.x);
  return {
    x: nc.x + Math.cos(angle) * rx,
    y: nc.y + Math.sin(angle) * ry,
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
