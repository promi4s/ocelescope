import { Text } from "@mantine/core";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";

export type PlaceNodeData = {
  label?: string | null;
  color: string;
  /** true when layout_attrs.peripheries === 2 (final marking place) */
  isFinalMarking: boolean;
  /** true when rank === "source" (initial marking place) */
  isInitialMarking: boolean;
};

export type PlaceNodeType = Node<PlaceNodeData, "place">;

export const PLACE_NODE_DIAMETER = 44;
const DIAMETER = PLACE_NODE_DIAMETER;

/** Darken a hex color by a fixed amount for borders. */
const darkenHex = (hex: string, amount = 40): string => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

/** Extract just the object-type portion from a backend label like "Order | m0=1 | mf=1". */
const parseObjectType = (label: string | null | undefined): string | null => {
  if (!label) return null;
  return label.split(" | ")[0]?.trim() ?? null;
};

const PlaceNode = memo(({ data }: NodeProps<PlaceNodeType>) => {
  const { color, label, isFinalMarking, isInitialMarking } = data;
  const objectType = parseObjectType(label);
  const borderColor = darkenHex(color);

  return (
    // The outer div provides the measured bounding box React Flow / ELK use.
    // Extra space below is reserved for the label so ELK accounts for it.
    <div
      style={{
        position: "relative",
        width: DIAMETER,
        // Extra height for label when present so ELK spacing is correct.
        paddingBottom: objectType ? 22 : 0,
      }}
    >
      {/* Hidden handles — floating edge logic computes actual attachment points */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      {/* Main circle */}
      <div
        style={{
          position: "relative",
          width: DIAMETER,
          height: DIAMETER,
          borderRadius: "50%",
          backgroundColor: color,
          border: `2px solid ${borderColor}`,
          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isFinalMarking && (
          <div
            style={{
              position: "absolute",
              inset: 5,
              borderRadius: "50%",
              border: `2px solid ${borderColor}`,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Token dot for initial-marking places */}
        {isInitialMarking && (
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.65)",
            }}
          />
        )}
      </div>

      {/* Object-type label below the circle */}
      {objectType && (
        <Text
          size="xs"
          fw={600}
          style={{
            position: "absolute",
            top: DIAMETER + 6,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            color: "#1a1a1a",
            pointerEvents: "none",
            letterSpacing: "0.01em",
          }}
        >
          {objectType}
        </Text>
      )}
    </div>
  );
});

PlaceNode.displayName = "PlaceNode";

export default PlaceNode;
