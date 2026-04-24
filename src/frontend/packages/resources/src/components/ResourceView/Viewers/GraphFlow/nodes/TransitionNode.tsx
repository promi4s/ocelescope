import { Text } from "@mantine/core";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";

export type TransitionNodeData = {
  label?: string | null;
  color: string;
  borderColor?: string | null;
  width: number;
  height: number;
};

export type TransitionNodeType = Node<TransitionNodeData, "transition">;

/** Silent transition: a thin black vertical bar, classic Petri net notation. */
const SilentTransition = ({ width, height }: { width: number; height: number }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: "#222",
      borderRadius: 2,
      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
    }}
  />
);

/** Labeled transition: a Mantine-styled activity box. */
const LabeledTransition = ({
  label,
  borderColor,
  width,
  height,
}: {
  label: string;
  borderColor?: string | null | undefined;
  width: number;
  height: number;
}) => (
  <div
    style={{
      width,
      height,
      boxSizing: "border-box",
      padding: "6px 12px",
      backgroundColor: "#ffffff",
      border: `1.5px solid ${borderColor ?? "#333"}`,
      borderRadius: 5,
      boxShadow: "0 2px 6px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text
      size="sm"
      fw={500}
      ta="center"
      style={{
        lineHeight: 1.2,
        color: "#111",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </Text>
  </div>
);

const TransitionNode = memo(({ data }: NodeProps<TransitionNodeType>) => {
  const { label, borderColor, width, height } = data;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      {label ? (
        <LabeledTransition
          label={label}
          borderColor={borderColor}
          width={width}
          height={height}
        />
      ) : (
        <SilentTransition width={width} height={height} />
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </>
  );
});

TransitionNode.displayName = "TransitionNode";

export default TransitionNode;
