import { Badge, Text } from "@mantine/core";
import type { GraphNode } from "@ocelescope/api-base";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import {
  DEFAULT_COLORS,
  EXTERNAL_NODE_LABEL_HEIGHT,
  type GraphFlowNodeType,
  MARKING_DOT_SIZE,
} from "../model/types";

// ─── Hidden handles ───────────────────────────────────────────────────────────

const HIDDEN_HANDLE_STYLE = { opacity: 0, pointerEvents: "none" } as const;

const HiddenHandles = () => (
  <>
    <Handle
      type="target"
      position={Position.Left}
      style={HIDDEN_HANDLE_STYLE}
    />
    <Handle
      type="source"
      position={Position.Right}
      style={HIDDEN_HANDLE_STYLE}
    />
  </>
);

// ─── Annotation badge ─────────────────────────────────────────────────────────

const AnnotationBadge = () => (
  <Badge
    size="xs"
    variant="filled"
    color="gray"
    title="This graph element has an annotation visualization."
    style={{ pointerEvents: "none" }}
  >
    i
  </Badge>
);

const NodeAnnotation = () => (
  <div style={{ position: "absolute", right: -8, top: -8 }}>
    <AnnotationBadge />
  </div>
);

// ─── External label (top / bottom) ────────────────────────────────────────────

const ExternalLabel = ({
  children,
  top,
}: {
  children: string;
  top: number;
}) => (
  <Text
    size="xs"
    fw={600}
    style={{
      position: "absolute",
      top,
      left: "50%",
      transform: "translateX(-50%)",
      whiteSpace: "nowrap",
      color: DEFAULT_COLORS.text,
      pointerEvents: "none",
      letterSpacing: "0.01em",
    }}
  >
    {children}
  </Text>
);

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

const CLIP_PATH: Partial<Record<GraphNode["shape"], string>> = {
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
  shape: Exclude<GraphNode["shape"], "circle">;
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

const GraphFlowNode = memo(({ data }: NodeProps<GraphFlowNodeType>) => {
  const {
    shape,
    label,
    color,
    border_color,
    annotation,
    label_pos,
    width,
    height,
    style,
  } = data;
  const doubleBorder = style?.double_border ?? null;
  const innerSymbol = style?.inner_symbol ?? null;
  const initialTokens = style?.initial_tokens ?? null;
  const finalTokens = style?.final_tokens ?? null;

  const isExternalLabel = Boolean(
    label && label_pos !== "center" && label_pos != null,
  );
  const bottomLabelTop =
    height != null ? EXTERNAL_NODE_LABEL_HEIGHT + height + 4 : null;

  // How many lines of text (size="sm" = 14px, lineHeight 1.2) fit inside the node.
  // Subtract 4px for the border simulation padding in BoxShape.
  // When height is null the node auto-sizes, so no clamping needed.
  const maxLabelLines =
    height != null
      ? Math.max(1, Math.floor((height - 4) / (14 * 1.2)))
      : undefined;

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
      {isExternalLabel && label_pos === "top" && (
        <ExternalLabel top={0}>{label as string}</ExternalLabel>
      )}
      {shape === "circle" ? (
        <CircleShape
          width={width as number}
          height={height as number}
          color={color ?? DEFAULT_COLORS.transition}
          borderColor={border_color ?? null}
          doubleBorder={doubleBorder}
          innerSymbol={innerSymbol}
          initialTokens={initialTokens}
          finalTokens={finalTokens}
          centerLabel={label_pos === "center" ? (label ?? null) : null}
        />
      ) : (
        <BoxShape
          shape={shape}
          color={color ?? DEFAULT_COLORS.transition}
          borderColor={border_color ?? null}
          doubleBorder={doubleBorder}
          innerSymbol={innerSymbol}
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
      {isExternalLabel && label_pos === "bottom" && bottomLabelTop != null && (
        <ExternalLabel top={bottomLabelTop}>{label as string}</ExternalLabel>
      )}
      {annotation && <NodeAnnotation />}
    </div>
  );
});

GraphFlowNode.displayName = "GraphFlowNode";

export default GraphFlowNode;
export { AnnotationBadge };
