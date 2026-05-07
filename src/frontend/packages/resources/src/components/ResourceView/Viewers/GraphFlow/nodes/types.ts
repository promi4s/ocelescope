import type { Node } from "@xyflow/react";

export type GraphFlowNodeData = {
  label?: string | null;
  shape: "circle" | "rectangle" | "triangle" | "diamond" | "hexagon";
  color: string;
  borderColor?: string | null;
  doubleBorder?: boolean | null;
  innerSymbol?: "triangle" | "square" | null;
  labelPos?: "top" | "center" | "bottom" | null;
  width?: number | null;
  height?: number | null;
  rank?: "source" | "sink" | number | null;
  annotation?: { type?: string } | null;
  // Numeric decorations rendered inside circle nodes
  initialTokens?: number | null;
  finalTokens?: number | null;
};

export type GraphFlowNodeType = Node<GraphFlowNodeData, "node">;
