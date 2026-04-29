import { Text } from "@mantine/core";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";

export type StartNodeData = {
  label?: string | null;
  color: string;
};

export type StartNodeType = Node<StartNodeData, "start">;

/** Standard process-model start symbol: a filled play triangle. */
const StartNode = memo(({ data }: NodeProps<StartNodeType>) => {
  const { color, label } = data;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "18px solid transparent",
          borderBottom: "18px solid transparent",
          borderLeft: `32px solid ${color}`,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
        }}
      />

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      {label && (
        <Text
          size="xs"
          fw={600}
          style={{
            whiteSpace: "nowrap",
            color: "#1a1a1a",
            pointerEvents: "none",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </Text>
      )}
    </div>
  );
});

StartNode.displayName = "StartNode";

export default StartNode;
