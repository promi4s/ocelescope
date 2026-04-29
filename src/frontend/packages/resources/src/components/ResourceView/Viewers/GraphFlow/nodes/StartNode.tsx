import { type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { TerminalNode } from "../components/TerminalNode";

export type StartNodeData = {
  label?: string | null;
  color: string;
};

export type StartNodeType = Node<StartNodeData, "start">;

const StartSymbol = ({ color }: { color: string }) => (
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
);

const StartNode = memo(({ data }: NodeProps<StartNodeType>) => (
  <TerminalNode label={data.label}>
    <StartSymbol color={data.color} />
  </TerminalNode>
));

StartNode.displayName = "StartNode";

export default StartNode;
