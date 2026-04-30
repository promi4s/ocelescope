import { type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { HiddenHandles } from "../components/HiddenHandles";
import { NodeLabel } from "../components/NodeLabel";
import {
  MARKING_DOT_SIZE,
  PLACE_NODE_DIAMETER,
} from "../constants/graphFlow";
import { darkenHex } from "../utils/color";
import { parseObjectType } from "../utils/labels";

export type PlaceNodeData = {
  label?: string | null;
  color: string;
  isFinalMarking: boolean;
  isInitialMarking: boolean;
  innerSymbol?: "triangle" | "square" | null;
};

export type PlaceNodeType = Node<PlaceNodeData, "place">;

const labelOffset = PLACE_NODE_DIAMETER + 6;

const InnerSymbol = ({
  symbol,
  borderColor,
}: {
  symbol: "triangle" | "square";
  borderColor: string;
}) => {
  if (symbol === "triangle") {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: `${MARKING_DOT_SIZE * 0.6}px solid transparent`,
          borderBottom: `${MARKING_DOT_SIZE * 0.6}px solid transparent`,
          borderLeft: `${MARKING_DOT_SIZE}px solid ${borderColor}`,
          marginLeft: 2,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: MARKING_DOT_SIZE,
        height: MARKING_DOT_SIZE,
        backgroundColor: borderColor,
      }}
    />
  );
};

const PlaceCircle = ({
  color,
  borderColor,
  isFinalMarking,
  isInitialMarking,
  innerSymbol,
}: {
  color: string;
  borderColor: string;
  isFinalMarking: boolean;
  isInitialMarking: boolean;
  innerSymbol?: "triangle" | "square" | null;
}) => (
  <div
    style={{
      position: "relative",
      width: PLACE_NODE_DIAMETER,
      height: PLACE_NODE_DIAMETER,
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

    {isInitialMarking && !innerSymbol && (
      <div
        style={{
          width: MARKING_DOT_SIZE,
          height: MARKING_DOT_SIZE,
          borderRadius: "50%",
          backgroundColor: "rgba(0,0,0,0.65)",
        }}
      />
    )}

    {innerSymbol && <InnerSymbol symbol={innerSymbol} borderColor={borderColor} />}
  </div>
);

const PlaceNode = memo(({ data }: NodeProps<PlaceNodeType>) => {
  const { color, label, isFinalMarking, isInitialMarking, innerSymbol } = data;
  const objectType = parseObjectType(label);
  const borderColor = darkenHex(color);

  return (
    <div
      style={{
        position: "relative",
        width: PLACE_NODE_DIAMETER,
        paddingBottom: objectType ? 22 : 0,
      }}
    >
      <HiddenHandles />
      <PlaceCircle
        color={color}
        borderColor={borderColor}
        isFinalMarking={isFinalMarking}
        isInitialMarking={isInitialMarking}
        innerSymbol={innerSymbol}
      />
      {objectType && (
        <NodeLabel absolute top={labelOffset}>
          {objectType}
        </NodeLabel>
      )}
    </div>
  );
});

PlaceNode.displayName = "PlaceNode";

export default PlaceNode;
export { PLACE_NODE_DIAMETER } from "../constants/graphFlow";
