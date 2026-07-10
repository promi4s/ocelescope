import { EdgeLabelRenderer } from "@xyflow/react";
import { AnnotationBadge } from "./annotation";

export const EdgeLabel = ({
  color,
  label,
  hasAnnotation,
  x,
  y,
}: {
  color: string;
  label?: string | null | undefined;
  hasAnnotation: boolean;
  x: number;
  y: number;
}) => (
  <EdgeLabelRenderer>
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: "all",
        backgroundColor: color,
        color: "#ffffff",
        fontSize: 11,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontWeight: 500,
        padding: "2px 6px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
      className="nodrag nopan"
    >
      {label}
      {hasAnnotation && <AnnotationBadge />}
    </div>
  </EdgeLabelRenderer>
);

export const EdgeEndLabel = ({
  label,
  x,
  y,
}: {
  label: string;
  x: number;
  y: number;
}) => (
  <EdgeLabelRenderer>
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: "none",
        color: "#444",
        fontSize: 10,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
      className="nodrag nopan"
    >
      {label}
    </div>
  </EdgeLabelRenderer>
);

export const END_LABEL_INSET = 22;
export const END_LABEL_PERP = 9;

export const endLabelPositions = (
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  return {
    start: {
      x: start.x + ux * END_LABEL_INSET + px * END_LABEL_PERP,
      y: start.y + uy * END_LABEL_INSET + py * END_LABEL_PERP,
    },
    end: {
      x: end.x - ux * END_LABEL_INSET + px * END_LABEL_PERP,
      y: end.y - uy * END_LABEL_INSET + py * END_LABEL_PERP,
    },
  };
};
