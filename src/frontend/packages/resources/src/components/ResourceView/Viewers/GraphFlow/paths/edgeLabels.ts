import type { ElkEdgeLabel, ElkEdgeSection } from "../layout/elkTypes";
import type { GraphPoint } from "../pipeline/types";

const sectionMidpoint = (section: ElkEdgeSection): GraphPoint | null => {
  if (!section.startPoint || !section.endPoint) return null;

  const points = [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ];
  const mid = points[Math.floor(points.length / 2)];

  return mid ? { x: mid.x, y: mid.y } : null;
};

export const getEdgeLabelPosition = (
  label: ElkEdgeLabel | undefined,
  section: ElkEdgeSection,
): GraphPoint | null => {
  if (label?.x != null && label?.y != null) {
    return {
      x: label.x + (label.width ?? 0) / 2,
      y: label.y + (label.height ?? 0) / 2,
    };
  }

  return sectionMidpoint(section);
};
