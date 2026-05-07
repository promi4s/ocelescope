import { EdgeLabelRenderer } from "@xyflow/react";
import { AnnotationBadge } from "../../components/AnnotationBadge";

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
