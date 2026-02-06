import dagre, { type GraphLabel } from "@dagrejs/dagre";
import { type Node, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

export const useDagreLayout = () => {
  const { getNodes, setNodes, getEdges, fitView } = useReactFlow();

  const layout = useCallback(
    async (options?: GraphLabel) => {
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph(options ?? { rankdir: "TB" });

      const nodes = getNodes();

      for (const node of nodes) {
        dagreGraph.setNode(node.id, {
          width: node.measured?.width,
          height: node.measured?.height,
        });
      }

      for (const edge of getEdges()) {
        dagreGraph.setEdge(edge.source, edge.target);
      }

      dagre.layout(dagreGraph);

      const positionedNodes: Node[] = nodes.map((node) => {
        const { x, y } = dagreGraph.node(node.id);

        return {
          ...node,
          position: { x, y },
        };
      });

      setNodes(positionedNodes);

      await fitView();
    },
    [getNodes, getEdges, setNodes, fitView],
  );

  return { layout };
};
