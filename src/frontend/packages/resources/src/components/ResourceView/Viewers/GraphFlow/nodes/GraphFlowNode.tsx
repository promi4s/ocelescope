import { Text } from "@mantine/core";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { HiddenHandles } from "../components/HiddenHandles";
import { NodeLabel } from "../components/NodeLabel";
import {
  EXTERNAL_NODE_LABEL_HEIGHT,
  MARKING_DOT_SIZE,
} from "../constants/graphFlow";
import { NodeAnnotation } from "./NodeAnnotation";
import type { GraphFlowNodeData, GraphFlowNodeType } from "./types";

// ─── Inner symbol ─────────────────────────────────────────────────────────────

const InnerSymbol = ({
  symbol,
  color,
}: {
  symbol: "triangle" | "square";
  color: string;
}) => {
  if (symbol === "triangle") {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: `${MARKING_DOT_SIZE * 0.6}px solid transparent`,
          borderBottom: `${MARKING_DOT_SIZE * 0.6}px solid transparent`,
          borderLeft: `${MARKING_DOT_SIZE}px solid ${color}`,
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
        backgroundColor: color,
      }}
    />
  );
};

// ─── Circle shape ─────────────────────────────────────────────────────────────

const CLIP_PATH: Partial<Record<GraphFlowNodeData["shape"], string>> = {
  triangle: "polygon(50% 0, 100% 100%, 0 100%)",
  diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  hexagon: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
};

const CircleShape = ({
  width,
  height,
  color,
  borderColor,
  doubleBorder,
  innerSymbol,
  initialTokens,
  finalTokens,
  centerLabel,
}: {
  width: number;
  height: number;
  color: string;
  borderColor: string | null;
  doubleBorder: boolean | null;
  innerSymbol: "triangle" | "square" | null;
  initialTokens: number | null;
  finalTokens: number | null;
  centerLabel: string | null;
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
    {doubleBorder && (
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
          style={{
            width: MARKING_DOT_SIZE,
            height: MARKING_DOT_SIZE,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.65)",
          }}
        />
      ) : (
        <span
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
      <InnerSymbol symbol={innerSymbol} color={borderColor ?? "#111"} />
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

// ─── Box shape (rectangle, triangle, diamond, hexagon) ────────────────────────

const BoxShape = ({
  shape,
  color,
  borderColor,
  doubleBorder,
  innerSymbol,
  width,
  height,
  children,
}: {
  shape: Exclude<GraphFlowNodeData["shape"], "circle">;
  color: string;
  borderColor: string | null;
  doubleBorder: boolean | null;
  innerSymbol: "triangle" | "square" | null;
  width: number | null;
  height: number | null;
  children?: React.ReactNode;
}) => {
  const clipPath = CLIP_PATH[shape];
  const hasBorder = borderColor != null;

  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: width ?? undefined,
        height: height ?? undefined,
        padding: hasBorder ? 2 : 0,
        backgroundColor: borderColor ?? "transparent",
        borderRadius: shape === "rectangle" ? 5 : 0,
        clipPath,
        boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          width: "100%",
          height: "100%",
          backgroundColor: color,
          borderRadius: shape === "rectangle" ? 3 : 0,
          clipPath,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {innerSymbol && !children ? (
          <InnerSymbol symbol={innerSymbol} color="#111" />
        ) : (
          children
        )}
      </div>
      {doubleBorder && (
        <div
          style={{
            position: "absolute",
            inset: 6,
            border: borderColor ? `1.5px solid ${borderColor}` : "none",
            borderRadius: shape === "rectangle" ? 3 : 0,
            clipPath,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

// ─── Node ─────────────────────────────────────────────────────────────────────

const GraphFlowNode = memo(({ data }: NodeProps<GraphFlowNodeType>) => {
  const {
    shape,
    label,
    color,
    borderColor,
    doubleBorder,
    innerSymbol,
    annotation,
    labelPos,
    width,
    height,
    initialTokens,
    finalTokens,
  } = data;

  const isExternalLabel = Boolean(
    label && labelPos !== "center" && labelPos != null,
  );
  const bottomLabelTop =
    height != null ? EXTERNAL_NODE_LABEL_HEIGHT + height + 4 : null;

  // How many lines of text (size="sm" = 14px, lineHeight 1.2) fit inside the node.
  // Subtract 4px for the border simulation padding in BoxShape.
  // When height is null the node auto-sizes, so no clamping needed.
  const maxLabelLines =
    height != null ? Math.max(1, Math.floor((height - 4) / (14 * 1.2))) : undefined;

  return (
    <div
      style={{
        position: "relative",
        width: shape === "circle" ? (width ?? undefined) : undefined,
        paddingTop: isExternalLabel ? EXTERNAL_NODE_LABEL_HEIGHT : 0,
        paddingBottom: isExternalLabel ? EXTERNAL_NODE_LABEL_HEIGHT : 0,
      }}
    >
      <HiddenHandles />
      {isExternalLabel && labelPos === "top" && (
        <NodeLabel absolute top={0}>
          {label as string}
        </NodeLabel>
      )}
      {shape === "circle" ? (
        <CircleShape
          width={width as number}
          height={height as number}
          color={color}
          borderColor={borderColor ?? null}
          doubleBorder={doubleBorder ?? null}
          innerSymbol={innerSymbol ?? null}
          initialTokens={initialTokens ?? null}
          finalTokens={finalTokens ?? null}
          centerLabel={labelPos === "center" ? (label ?? null) : null}
        />
      ) : (
        <BoxShape
          shape={shape}
          color={color}
          borderColor={borderColor ?? null}
          doubleBorder={doubleBorder ?? null}
          innerSymbol={innerSymbol ?? null}
          width={width ?? null}
          height={height ?? null}
        >
          {!isExternalLabel && label && (
            <Text
              size="sm"
              fw={500}
              ta="center"
              px={12}
              style={{
                lineHeight: 1.2,
                color: "#111",
                maxWidth: width != null ? width : "100%",
                boxSizing: "border-box",
                overflow: "hidden",
                overflowWrap: "anywhere",
                // Multi-line clamp: fill the node with wrapped text, ellipsis only
                // when the text still exceeds the node height after wrapping.
                ...(maxLabelLines != null
                  ? ({
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: maxLabelLines,
                    } as React.CSSProperties)
                  : { whiteSpace: "normal" }),
              }}
            >
              {label}
            </Text>
          )}
        </BoxShape>
      )}
      {isExternalLabel && labelPos === "bottom" && bottomLabelTop != null && (
        <NodeLabel absolute top={bottomLabelTop}>
          {label as string}
        </NodeLabel>
      )}
      {annotation && <NodeAnnotation />}
    </div>
  );
});

GraphFlowNode.displayName = "GraphFlowNode";

export default GraphFlowNode;
