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

export const useGraphFlowLayout = (visualization: VisualizationByType<"graph">) => {
  const [nodes, setNodes] = useState<Node[]>(() => buildGraphFlowNodes(visualization) as Node[]);
  const [edges, setEdges] = useState<Edge[]>(() => buildGraphFlowEdges(visualization) as Edge[]);
  const [layoutReady, setLayoutReady] = useState(false);

  const { fitView } = useReactFlow();
  const measuredNodes = useNodes();
  const nodesInitialized = useNodesInitialized();
  const layoutApplied = useRef(false);
  const layoutIdRef = useRef(0);
  const latestInput = useRef({ measuredNodes, edges, visualization });

  // Keep latest input in sync every render
  useEffect(() => {
    latestInput.current = { measuredNodes, edges, visualization };
  });

  // Reset when visualization changes
  useEffect(() => {
    setNodes(buildGraphFlowNodes(visualization) as Node[]);
    setEdges(buildGraphFlowEdges(visualization) as Edge[]);
    setLayoutReady(false);
    layoutApplied.current = false;
    layoutIdRef.current++;
  }, [visualization]);

  // Run ELK layout once nodes are measured
  useEffect(() => {
    if (!nodesInitialized || layoutApplied.current) return;
    layoutApplied.current = true;

    const myLayoutId = layoutIdRef.current;

    const runLayout = async () => {
      const { measuredNodes: currentNodes, edges: currentEdges, visualization: currentViz } =
        latestInput.current;

      if (currentNodes.length === 0) {
        setLayoutReady(true);
        return;
      }

      try {
        const { positions, edgeLayouts } = await layoutWithElk({
          nodes: currentNodes,
          edges: currentEdges,
          visualization: currentViz,
        });

        // Discard result if visualization changed while ELK was running
        if (myLayoutId !== layoutIdRef.current) {
          layoutApplied.current = false;
          return;
        }

        setNodes((current) =>
          current.map((node) => {
            const pos = positions[node.id];
            return pos ? { ...node, position: pos } : node;
          }),
        );

        setEdges((current) =>
          current.map((edge) => {
            const layout = edgeLayouts[edge.id];
            if (!layout) return edge;
            return {
              ...edge,
              data: { ...edge.data, path: layout.path, labelPosition: layout.labelPosition },
            };
          }),
        );

        setLayoutReady(true);
        requestAnimationFrame(() => fitView({ padding: FIT_VIEW_PADDING }));
      } catch (err) {
        console.error("[GraphFlow] ELK layout failed:", err);
        layoutApplied.current = false;
      }
    };

    void runLayout();
  }, [fitView, nodesInitialized]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return { nodes, edges, layoutReady, onNodesChange };
};
