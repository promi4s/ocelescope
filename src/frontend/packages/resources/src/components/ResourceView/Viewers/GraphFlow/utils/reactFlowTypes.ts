import PlaceNode from "../nodes/PlaceNode";
import TransitionNode from "../nodes/TransitionNode";
import GraphFlowEdge from "../edges/GraphFlowEdge";

export const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
};

export const edgeTypes = {
  graphflow: GraphFlowEdge,
};
