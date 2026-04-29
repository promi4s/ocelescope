import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  useNodes,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import type { VisualizationByType } from "../../../../../types";
import { FIT_VIEW_PADDING } from "../constants/graphFlow";
import { buildGraphFlowEdges, buildGraphFlowNodes } from "../builders";
import { layoutWithElk } from "../layout/elk";

export const useGraphFlowLayout = (
  visualization: VisualizationByType<"graph">,
) => {
  const [nodes, setNodes] = useState<Node[]>(() => buildGraphFlowNodes(visualization) as Node[]);
  const [edges, setEdges] = useState<Edge[]>(() => buildGraphFlowEdges(visualization) as Edge[]);

  const { fitView } = useReactFlow();
  const measuredNodes = useNodes();
  const nodesInitialized = useNodesInitialized();
  const layoutApplied = useRef(false);
  const latestLayoutInput = useRef({ measuredNodes, edges, visualization });

  useEffect(() => {
    latestLayoutInput.current = { measuredNodes, edges, visualization };
  });

  useEffect(() => {
    setNodes(buildGraphFlowNodes(visualization) as Node[]);
    setEdges(buildGraphFlowEdges(visualization) as Edge[]);
    layoutApplied.current = false;
  }, [visualization]);

  useEffect(() => {
    if (!nodesInitialized || layoutApplied.current) return;
    layoutApplied.current = true;

    const runLayout = async () => {
      const { measuredNodes: currentNodes, edges: currentEdges, visualization: currentVisualization } =
        latestLayoutInput.current;

      if (currentNodes.length === 0) return;

      try {
        const positions = await layoutWithElk({
          nodes: currentNodes,
          edges: currentEdges,
          visualization: currentVisualization,
        });

        setNodes((current) =>
          current.map((node) => {
            const pos = positions[node.id];
            return pos ? { ...node, position: pos } : node;
          }),
        );
      } finally {
        requestAnimationFrame(() => fitView({ padding: FIT_VIEW_PADDING }));
      }
    };

    void runLayout();
  }, [fitView, nodesInitialized]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return { nodes, edges, onNodesChange };
};
