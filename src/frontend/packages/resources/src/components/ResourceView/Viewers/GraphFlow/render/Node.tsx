import { Text } from "@mantine/core";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { type CSSProperties, memo } from "react";
import type { VisualizationsType } from "../../../../../types";
import { DEFAULT_COLORS, type GraphFlowNodeType } from "../model/types";
import { NodeAnnotation } from "./annotation";
import { BoxShape, CircleShape } from "./nodeShapes";

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

const ExternalLabel = ({
  children,
  placement,
}: {
  children: string;
  placement: "top" | "bottom";
}) => (
  <Text
    size="xs"
    fw={600}
    style={{
      position: "absolute",
      [placement === "top" ? "bottom" : "top"]: "100%",
      left: "50%",
      transform: `translate(-50%, ${placement === "top" ? "-4px" : "4px"})`,
      whiteSpace: "nowrap",
      color: DEFAULT_COLORS.text,
      pointerEvents: "none",
      letterSpacing: "0.01em",
    }}
  >
    {children}
  </Text>
);

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

  const maxLabelLines =
    height != null
      ? Math.max(1, Math.floor((height - 4) / (14 * 1.2)))
      : undefined;

  return (
    <div
      style={{
        position: "relative",
        width: shape === "circle" ? (width ?? undefined) : undefined,
      }}
    >
      <HiddenHandles />
      {isExternalLabel && label_pos === "top" && (
        <ExternalLabel placement="top">{label as string}</ExternalLabel>
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
                    } as CSSProperties)
                  : { whiteSpace: "normal" }),
              }}
            >
              {label}
            </Text>
          )}
        </BoxShape>
      )}
      {isExternalLabel && label_pos === "bottom" && (
        <ExternalLabel placement="bottom">{label as string}</ExternalLabel>
      )}
      {annotation && (
        <NodeAnnotation annotation={annotation as VisualizationsType} />
      )}
    </div>
  );
});

GraphFlowNode.displayName = "GraphFlowNode";

export default GraphFlowNode;
