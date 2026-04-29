import EndNode from "../nodes/EndNode";
import PlaceNode from "../nodes/PlaceNode";
import StartNode from "../nodes/StartNode";
import TransitionNode from "../nodes/TransitionNode";
import GraphFlowEdge from "../edges/GraphFlowEdge";

export const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
  start: StartNode,
  end: EndNode,
};

export const edgeTypes = {
  graphflow: GraphFlowEdge,
};
