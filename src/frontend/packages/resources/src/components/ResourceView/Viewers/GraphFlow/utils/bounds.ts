import type { Edge, Node } from "@xyflow/react";

export type Rect = { x: number; y: number; width: number; height: number };

function nodeBoundsFromData(nodes: Node[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;
    const w = (node.measured?.width as number | undefined) ?? 0;
    const h = (node.measured?.height as number | undefined) ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  return isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: 0, y: 0, width: 0, height: 0 };
}

// All numbers in our ELK paths (M/L polylines and M/C splines) are x,y
// coordinates — no non-coordinate numbers like arc flags or radii appear.
function svgPathBounds(d: string): Rect | null {
  const nums = (d.match(/-?[\d.]+(?:e[+-]?\d+)?/gi) ?? []).map(parseFloat);
  if (nums.length < 2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]!);
    minY = Math.min(minY, nums[i + 1]!);
    maxX = Math.max(maxX, nums[i]!);
    maxY = Math.max(maxY, nums[i + 1]!);
  }
  return isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : null;
}

/**
 * Computes content bounds from graph data without touching the DOM.
 * Uses node positions/sizes and pre-computed ELK edge paths.
 * Safe to call immediately after layout with no timing concerns.
 */
export function computeAutoFitBounds(nodes: Node[], edges: Edge[]): Rect {
  let combined = nodeBoundsFromData(nodes);
  for (const edge of edges) {
    const path = (edge.data as { path?: string } | undefined)?.path;
    if (!path) continue;
    const eb = svgPathBounds(path);
    if (eb) combined = unionRects(combined, eb);
  }
  return combined;
}

function unionRects(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Reads the viewport transform directly from the inline style React Flow writes:
 * `transform: translate(Xpx, Ypx) scale(Z)`
 */
function parseViewportTransform(
  viewportEl: HTMLElement,
): { x: number; y: number; zoom: number } | null {
  const match = (viewportEl.style.transform ?? "").match(
    /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/,
  );
  if (!match) return null;
  return {
    x: parseFloat(match[1]!),
    y: parseFloat(match[2]!),
    zoom: parseFloat(match[3]!),
  };
}

/**
 * Returns the bounding rect (in flow coordinates) of all nodes plus all
 * rendered edge paths. React Flow's built-in helpers only account for nodes;
 * curved or long edges can extend well outside the node bounds, causing them
 * to be clipped in exports and in fitView.
 *
 * In @xyflow/react v12 each edge is wrapped in its own <svg> (position:
 * absolute), so getBBox() coordinates are not reliably in flow space. Instead
 * we use getBoundingClientRect() on each .react-flow__edge-path element and
 * convert from screen coords back to flow coords via the inverse of the
 * viewport's CSS transform.
 */
export function getContentBounds(
  nodes: Node[],
  viewportEl: HTMLElement,
  getNodesBounds: (nodes: Node[]) => Rect,
): Rect {
  const nodeBounds = getNodesBounds(nodes);

  const vt = parseViewportTransform(viewportEl);
  if (!vt || vt.zoom === 0) return nodeBounds;

  // The viewport transform origin is the top-left of the renderer (the
  // viewport element's parent), which is position:absolute inset:0 inside
  // the React Flow container.
  const containerRect = viewportEl.parentElement?.getBoundingClientRect();
  if (!containerRect) return nodeBounds;

  const edgePaths = viewportEl.querySelectorAll<Element>(
    ".react-flow__edge-path",
  );
  if (edgePaths.length === 0) return nodeBounds;

  let combined = nodeBounds;
  for (const path of Array.from(edgePaths)) {
    const rect = path.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    // Convert screen coords → flow coords using the inverse viewport transform:
    // screen = container + vt.{x,y} + flow * vt.zoom  →  flow = (screen - container - vt) / zoom
    const flowX = (rect.left - containerRect.left - vt.x) / vt.zoom;
    const flowY = (rect.top - containerRect.top - vt.y) / vt.zoom;
    const flowRight = (rect.right - containerRect.left - vt.x) / vt.zoom;
    const flowBottom = (rect.bottom - containerRect.top - vt.y) / vt.zoom;
    combined = unionRects(combined, {
      x: flowX,
      y: flowY,
      width: flowRight - flowX,
      height: flowBottom - flowY,
    });
  }

  return combined;
}
