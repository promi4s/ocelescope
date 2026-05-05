import { Text } from "@mantine/core";
import type { Node, NodeProps } from "@xyflow/react";
import { memo } from "react";
import { AnnotationBadge } from "../components/AnnotationBadge";
import { HiddenHandles } from "../components/HiddenHandles";
import { NodeLabel } from "../components/NodeLabel";

export type TransitionNodeData = {
  label?: string | null;
  shape: "triangle" | "rectangle" | "diamond" | "hexagon";
  color: string;
  borderColor?: string | null;
  doubleBorder?: boolean;
  innerSymbol?: "triangle" | "square" | null;
  annotation?: { type?: string } | null;
  labelPos?: "top" | "center" | "bottom" | null;
  width?: number | null;
  height?: number | null;
  rank?: "source" | "sink" | number | null;
};

export type TransitionNodeType = Node<TransitionNodeData, "transition">;

const SHAPE_CLIP_PATH: Record<TransitionNodeData["shape"], string | undefined> =
  {
    rectangle: undefined,
    triangle: "polygon(50% 0, 100% 100%, 0 100%)",
    diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
    hexagon: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
  };

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
          borderTop: "5px solid transparent",
          borderBottom: "5px solid transparent",
          borderLeft: `9px solid ${color}`,
        }}
      />
    );
  }

  return <div style={{ width: 9, height: 9, backgroundColor: color }} />;
};

const SilentTransition = ({
  color,
  width,
  height,
}: {
  color: string;
  width: number;
  height: number;
}) => (
  <div
    style={{
      width,
      height,
      backgroundColor: color,
      borderRadius: 2,
      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
    }}
  />
);

const TransitionBox = ({
  shape,
  color,
  borderColor,
  doubleBorder,
  innerSymbol,
  width,
  height,
  children,
}: {
  shape: TransitionNodeData["shape"];
  color: string;
  borderColor?: string | null;
  doubleBorder?: boolean | undefined;
  innerSymbol?: "triangle" | "square" | null | undefined;
  width?: number | null;
  height?: number | null;
  children?: React.ReactNode;
}) => {
  const clipPath = SHAPE_CLIP_PATH[shape];
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
          padding: "0 12px",
          backgroundColor: color,
          borderRadius: shape === "rectangle" ? 3 : 0,
          clipPath,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

const TransitionNode = memo(({ data }: NodeProps<TransitionNodeType>) => {
  const {
    label,
    shape,
    color,
    borderColor,
    doubleBorder,
    innerSymbol,
    annotation,
    labelPos,
    width,
    height,
  } = data;

  const isSilent = shape === "rectangle" && !label;
  const isExternalLabel = label && labelPos !== "center" && labelPos != null;
  const boxWidth = width ?? null;
  const bottomLabelTop = height != null ? height + 4 : null;

  return (
    <div style={{ position: "relative" }}>
      <HiddenHandles />
      {isExternalLabel && labelPos === "top" && (
        <NodeLabel absolute top={-20}>
          {label}
        </NodeLabel>
      )}
      {isSilent ? (
        <SilentTransition color={color} width={width as number} height={height as number} />
      ) : (
        <TransitionBox
          shape={shape}
          color={color}
          borderColor={borderColor ?? null}
          doubleBorder={doubleBorder}
          innerSymbol={innerSymbol}
          width={width as number}
          height={height as number}
        >
          {!isExternalLabel && (
            <Text
              size="sm"
              fw={500}
              ta="center"
              style={{
                lineHeight: 1.2,
                color: "#111",
                maxWidth: boxWidth != null ? boxWidth - 24 : undefined,
                overflowWrap: "anywhere",
                whiteSpace: "normal",
              }}
            >
              {label}
            </Text>
          )}
        </TransitionBox>
      )}
      {isExternalLabel && labelPos === "bottom" && bottomLabelTop != null && (
        <NodeLabel absolute top={bottomLabelTop}>
          {label}
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

TransitionNode.displayName = "TransitionNode";

export default TransitionNode;
