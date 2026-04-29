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
};

export type PlaceNodeType = Node<PlaceNodeData, "place">;

const labelOffset = PLACE_NODE_DIAMETER + 6;

const PlaceCircle = ({
  color,
  borderColor,
  isFinalMarking,
  isInitialMarking,
}: {
  color: string;
  borderColor: string;
  isFinalMarking: boolean;
  isInitialMarking: boolean;
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

    {isInitialMarking && (
      <div
        style={{
          width: MARKING_DOT_SIZE,
          height: MARKING_DOT_SIZE,
          borderRadius: "50%",
          backgroundColor: "rgba(0,0,0,0.65)",
        }}
      />
    )}
  </div>
);

const PlaceNode = memo(({ data }: NodeProps<PlaceNodeType>) => {
  const { color, label, isFinalMarking, isInitialMarking } = data;
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
