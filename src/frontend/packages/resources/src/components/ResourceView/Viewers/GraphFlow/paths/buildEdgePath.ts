import type { ElkEdgeSection } from "../layout/elkTypes";
import type { GraphEdgeRouting } from "../pipeline/types";
import { buildPolylinePath } from "./polylinePath";
import { buildSplinePath } from "./splinePath";

const sectionPoints = (section: ElkEdgeSection) => {
  const start = section.startPoint;
  const end = section.endPoint;
  if (!start || !end) return null;

  return [start, ...(section.bendPoints ?? []), end];
};

export const buildEdgePath = (
  section: ElkEdgeSection,
  routing: GraphEdgeRouting,
): string | null => {
  if (routing === "SPLINES") {
    return buildSplinePath(section);
  }

  const points = sectionPoints(section);
  if (!points) return null;

  return buildPolylinePath(points);
};
