import type { Edge, Node } from "@xyflow/react";
import type { EndNodeType } from "../nodes/EndNode";
import type { PlaceNodeType } from "../nodes/PlaceNode";
import type { StartNodeType } from "../nodes/StartNode";
import type { TransitionNodeType } from "../nodes/TransitionNode";
import type { GraphFlowEdgeType } from "../edges/GraphFlowEdge";

export type GraphFlowNodeType =
  | PlaceNodeType
  | TransitionNodeType
  | StartNodeType
  | EndNodeType;

export type GraphFlowReactNode = Node<GraphFlowNodeType["data"]>;
export type GraphFlowReactEdge = Edge<NonNullable<GraphFlowEdgeType["data"]>>;

export type ElkDirection = "DOWN" | "RIGHT" | "LEFT" | "UP";
