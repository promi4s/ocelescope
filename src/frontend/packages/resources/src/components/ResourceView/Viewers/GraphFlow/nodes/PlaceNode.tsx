import type { Node, NodeProps } from "@xyflow/react";
import { memo } from "react";
import { AnnotationBadge } from "../components/AnnotationBadge";
import { HiddenHandles } from "../components/HiddenHandles";
import { NodeLabel } from "../components/NodeLabel";
import {
  EXTERNAL_NODE_LABEL_HEIGHT,
  MARKING_DOT_SIZE,
} from "../constants/graphFlow";
import { parseObjectType } from "../utils/labels";

export type PlaceNodeData = {
  label?: string | null;
  color: string;
  borderColor?: string | null | undefined;
  isFinalMarking: boolean;
  initialTokens?: number | null | undefined;
  finalTokens?: number | null | undefined;
  innerSymbol?: "triangle" | "square" | null;
  annotation?: { type?: string } | null;
  labelPos?: "top" | "center" | "bottom" | null;
  width?: number | null;
  height?: number | null;
  rank?: "source" | "sink" | number | null;
};

export type PlaceNodeType = Node<PlaceNodeData, "place">;

const InnerSymbol = ({
  symbol,
  borderColor,
}: {
  symbol: "triangle" | "square";
  borderColor: string | null;
}) => {
  if (!borderColor) {
    return null;
  }

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
  width,
  height,
  color,
  borderColor,
  isFinalMarking,
  initialTokens,
  finalTokens,
  innerSymbol,
  centerLabel,
}: {
  width: number;
  height: number;
  color: string;
  borderColor: string | null;
  isFinalMarking: boolean;
  initialTokens?: number | null | undefined;
  finalTokens?: number | null | undefined;
  innerSymbol?: "triangle" | "square" | null | undefined;
  centerLabel?: string | null | undefined;
}) => (
  <div
    style={{
      position: "relative",
      boxSizing: "border-box",
      width,
      height,
      borderRadius: "50%",
      backgroundColor: color,
      border: borderColor ? `2px solid ${borderColor}` : "none",
      boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    }}
  >
    {(isFinalMarking || Boolean(finalTokens)) && (
      <div
        style={{
          position: "absolute",
          inset: 5,
          borderRadius: "50%",
          border: borderColor ? `2px solid ${borderColor}` : "none",
          pointerEvents: "none",
        }}
      />
    )}

    {initialTokens &&
      !innerSymbol &&
      (initialTokens === 1 ? (
        <div
          title="Initial marking: 1"
          style={{
            width: MARKING_DOT_SIZE,
            height: MARKING_DOT_SIZE,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.65)",
          }}
        />
      ) : (
        <span
          title={`Initial marking: ${initialTokens}`}
          style={{
            color: "#111",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {initialTokens}
        </span>
      ))}

    {finalTokens && finalTokens > 1 && (
      <span
        title={`Final marking: ${finalTokens}`}
        style={{
          position: "absolute",
          right: 4,
          bottom: 3,
          color: "#111",
          fontSize: 9,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {finalTokens}
      </span>
    )}

    {innerSymbol && (
      <InnerSymbol symbol={innerSymbol} borderColor={borderColor} />
    )}
    {centerLabel && (
      <span
        style={{
          maxWidth: width - 6,
          color: "#111",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          overflow: "hidden",
          textAlign: "center",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {centerLabel}
      </span>
    )}
  </div>
);

const PlaceNode = memo(({ data }: NodeProps<PlaceNodeType>) => {
  const {
    color,
    label,
    borderColor,
    isFinalMarking,
    initialTokens,
    finalTokens,
    innerSymbol,
    annotation,
    labelPos,
    width,
    height,
  } = data;
  const objectType = parseObjectType(label);
  const visualWidth = width as number;
  const visualHeight = height as number;
  const labelOffset = EXTERNAL_NODE_LABEL_HEIGHT + visualHeight + 6;
  const showLabelOnTop = labelPos === "top";
  const showLabelInCenter = labelPos === "center";
  const showExternalLabel = objectType && !showLabelInCenter;

  return (
    <div
      style={{
        position: "relative",
        width: visualWidth,
        paddingTop: showExternalLabel ? EXTERNAL_NODE_LABEL_HEIGHT : 0,
        paddingBottom: showExternalLabel ? EXTERNAL_NODE_LABEL_HEIGHT : 0,
      }}
    >
      <HiddenHandles />
      {showExternalLabel && showLabelOnTop && (
        <NodeLabel absolute top={-EXTERNAL_NODE_LABEL_HEIGHT}>
          {objectType}
        </NodeLabel>
      )}
      <PlaceCircle
        width={visualWidth}
        height={visualHeight}
        color={color}
        borderColor={borderColor ?? null}
        isFinalMarking={isFinalMarking}
        initialTokens={initialTokens}
        finalTokens={finalTokens}
        innerSymbol={innerSymbol ?? null}
        centerLabel={objectType && showLabelInCenter ? objectType : null}
      />
      {showExternalLabel && !showLabelOnTop && (
        <NodeLabel absolute top={labelOffset}>
          {objectType}
        </NodeLabel>
      )}
      {annotation && (
        <div style={{ position: "absolute", right: -8, top: -8 }}>
          <AnnotationBadge />
        </div>
      )}
    </div>
  );
});

PlaceNode.displayName = "PlaceNode";

export default PlaceNode;
