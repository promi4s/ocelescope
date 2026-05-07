import { EdgeLabelRenderer } from "@xyflow/react";

export const EdgeEndLabel = ({
  label,
  x,
  y,
  offsetX,
  offsetY,
}: {
  label: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}) => (
  <EdgeLabelRenderer>
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x + offsetX}px, ${y + offsetY}px)`,
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
