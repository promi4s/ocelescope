import type { GraphNode } from "@ocelescope/api-base";
import type { Node } from "@xyflow/react";

export type GraphFlowNodeType = Node<
  GraphNode & Record<string, unknown>,
  "node"
>;
