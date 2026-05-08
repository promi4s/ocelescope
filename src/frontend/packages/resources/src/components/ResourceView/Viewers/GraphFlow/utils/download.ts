import type { Node } from "@xyflow/react";
import type { Rect } from "./bounds";
import { saveAs } from "file-saver";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
import { getContentBounds } from "./bounds";

const MAX_PX = 2048;
// Proportional padding added on each side of the graph bounds (5% of graph size).
const EXPORT_PADDING = 0.05;

function buildCaptureOptions(
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
  zoom: number,
) {
  return {
    backgroundColor: "#ffffff",
    width: imageWidth,
    height: imageHeight,
    skipFonts: true,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
    filter: (node: Element | Text) =>
      !(node instanceof Element) ||
      (!node.classList.contains("react-flow__panel") &&
        !node.classList.contains("react-flow__background")),
  };
}

function resolveViewport(
  container: HTMLElement,
  nodes: Node[],
  getNodesBounds: (nodes: Node[]) => Rect,
): {
  viewportEl: HTMLElement;
  imageWidth: number;
  imageHeight: number;
  x: number;
  y: number;
  zoom: number;
} | null {
  if (nodes.length === 0) return null;
  const viewportEl = container.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement | null;
  if (!viewportEl) return null;
  const bounds = getContentBounds(nodes, viewportEl, getNodesBounds);

  // Add symmetric padding in flow coordinates, then scale so the padded area
  // fits within MAX_PX. This gives exact, symmetric margins — unlike
  // getViewportForBounds whose internal formula can distribute padding unevenly.
  const padX = bounds.width * EXPORT_PADDING;
  const padY = bounds.height * EXPORT_PADDING;
  const paddedWidth = bounds.width + 2 * padX;
  const paddedHeight = bounds.height + 2 * padY;

  const zoom = Math.min(MAX_PX / paddedWidth, MAX_PX / paddedHeight);
  const imageWidth = Math.round(paddedWidth * zoom);
  const imageHeight = Math.round(paddedHeight * zoom);

  // Map the padded top-left corner (bounds.x - padX, bounds.y - padY) to pixel (0, 0).
  const x = (padX - bounds.x) * zoom;
  const y = (padY - bounds.y) * zoom;

  return { viewportEl, imageWidth, imageHeight, x, y, zoom };
}

export async function downloadPng(
  container: HTMLElement,
  nodes: Node[],
  getNodesBounds: (nodes: Node[]) => Rect,
): Promise<void> {
  const capture = resolveViewport(container, nodes, getNodesBounds);
  if (!capture) return;
  const { viewportEl, imageWidth, imageHeight, x, y, zoom } = capture;
  const dataUrl = await toPng(
    viewportEl,
    buildCaptureOptions(imageWidth, imageHeight, x, y, zoom),
  );
  saveAs(dataUrl, "graph.png");
}

export async function downloadSvg(
  container: HTMLElement,
  nodes: Node[],
  getNodesBounds: (nodes: Node[]) => Rect,
): Promise<void> {
  const capture = resolveViewport(container, nodes, getNodesBounds);
  if (!capture) return;
  const { viewportEl, imageWidth, imageHeight, x, y, zoom } = capture;
  const dataUrl = await toSvg(
    viewportEl,
    buildCaptureOptions(imageWidth, imageHeight, x, y, zoom),
  );
  saveAs(dataUrl, "graph.svg");
}

export async function downloadPdf(
  container: HTMLElement,
  nodes: Node[],
  getNodesBounds: (nodes: Node[]) => Rect,
): Promise<void> {
  const capture = resolveViewport(container, nodes, getNodesBounds);
  if (!capture) return;
  const { viewportEl, imageWidth, imageHeight, x, y, zoom } = capture;
  const dataUrl = await toPng(
    viewportEl,
    buildCaptureOptions(imageWidth, imageHeight, x, y, zoom),
  );
  const orientation = imageWidth >= imageHeight ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [imageWidth, imageHeight],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, imageWidth, imageHeight);
  pdf.save("graph.pdf");
}
