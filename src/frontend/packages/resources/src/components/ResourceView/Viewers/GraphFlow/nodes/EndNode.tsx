import { Text } from "@mantine/core";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";

export type EndNodeData = {
  label?: string | null;
  color: string;
};

export type EndNodeType = Node<EndNodeData, "end">;

/** Standard process-model end symbol: a filled square. */
const EndNode = memo(({ data }: NodeProps<EndNodeType>) => {
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
          width: 32,
          height: 32,
          backgroundColor: color,
          borderRadius: 3,
          boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
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

EndNode.displayName = "EndNode";

export default EndNode;
