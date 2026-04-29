import { type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { TerminalNode } from "../components/TerminalNode";
import { TERMINAL_NODE_SIZE } from "../constants/graphFlow";

export type EndNodeData = {
  label?: string | null;
  color: string;
};

export type EndNodeType = Node<EndNodeData, "end">;

const EndSymbol = ({ color }: { color: string }) => (
  <div
    style={{
      width: TERMINAL_NODE_SIZE,
      height: TERMINAL_NODE_SIZE,
      backgroundColor: color,
      borderRadius: 3,
      boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
    }}
  />
);

const EndNode = memo(({ data }: NodeProps<EndNodeType>) => (
  <TerminalNode label={data.label}>
    <EndSymbol color={data.color} />
  </TerminalNode>
));

EndNode.displayName = "EndNode";

export default EndNode;
