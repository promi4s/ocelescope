import type { EdgeArrow } from "../types";

export type ArrowMarkerProps = {
  id: string;
  type: EdgeArrow;
  color: string;
  isStart: boolean;
};

export const ArrowMarker = ({ id, type, color, isStart }: ArrowMarkerProps) => {
  if (!type) return null;

  const commonProps = {
    id,
    orient: isStart ? "auto-start-reverse" : "auto",
    markerUnits: "strokeWidth" as const,
  };

  switch (type) {
    case "triangle":
      return (
        <marker
          {...commonProps}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      );
    case "vee":
      return (
        <marker
          {...commonProps}
          markerWidth="8"
          markerHeight="6"
          refX="6"
          refY="3"
        >
          <path
            d="M0,0 L8,3 L0,6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
        </marker>
      );
    case "chevron":
      return (
        <marker
          {...commonProps}
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
        >
          <path
            d="M0,0 L5,3 L0,6"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
        </marker>
      );
    case "tee":
      return (
        <marker
          {...commonProps}
          markerWidth="3"
          markerHeight="6"
          refX="1"
          refY="3"
        >
          <path d="M1,0 L1,6" stroke={color} strokeWidth="1.5" fill="none" />
        </marker>
      );
    case "circle":
      return (
        <marker
          {...commonProps}
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
        >
          <circle cx="3" cy="3" r="2.5" fill={color} />
        </marker>
      );
    case "circle-triangle":
      return (
        <marker
          {...commonProps}
          markerWidth="13"
          markerHeight="6"
          refX="12"
          refY="3"
        >
          <circle cx="2.5" cy="3" r="2.5" fill={color} />
          <path d="M5,0 L5,6 L13,3 z" fill={color} />
        </marker>
      );
    case "triangle-backcurve":
      return (
        <marker
          {...commonProps}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
        >
          <path d="M0,0 Q4,3 0,6 L8,3 z" fill={color} />
        </marker>
      );
    case "triangle-tee":
      return (
        <marker
          {...commonProps}
          markerWidth="11"
          markerHeight="6"
          refX="10"
          refY="3"
        >
          <path d="M0,0 L0,6" stroke={color} strokeWidth="1.5" fill="none" />
          <path d="M2,0 L2,6 L10,3 z" fill={color} />
        </marker>
      );
    case "triangle-cross":
      return (
        <marker
          {...commonProps}
          markerWidth="11"
          markerHeight="6"
          refX="10"
          refY="3"
        >
          <path
            d="M0,0 L4,6 M4,0 L0,6"
            stroke={color}
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M5,0 L5,6 L11,3 z" fill={color} />
        </marker>
      );
    case "square":
      return (
        <marker
          {...commonProps}
          markerWidth="7"
          markerHeight="6"
          refX="6"
          refY="3"
        >
          <rect x="0" y="0" width="6" height="6" fill={color} />
        </marker>
      );
    case "diamond":
      return (
        <marker
          {...commonProps}
          markerWidth="9"
          markerHeight="6"
          refX="8"
          refY="3"
        >
          <path d="M0,3 L4,0 L8,3 L4,6 z" fill={color} />
        </marker>
      );
    default:
      return null;
  }
};
