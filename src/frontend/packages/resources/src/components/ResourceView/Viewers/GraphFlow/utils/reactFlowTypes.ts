import GraphFlowEdge from "../edges/GraphFlowEdge";
import PlaceNode from "../nodes/PlaceNode";
import TransitionNode from "../nodes/TransitionNode";

export const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
};

export const edgeTypes = {
  graphflow: GraphFlowEdge,
};
