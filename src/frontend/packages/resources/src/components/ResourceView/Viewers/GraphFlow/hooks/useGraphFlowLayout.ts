import {
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  useNodes,
  useNodesInitialized,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VisualizationByType } from "../../../../../types";
import {
  canRunElkLayout,
  composeGraphLayout,
  createErrorLayoutSnapshot,
  createInitialLayoutSnapshot,
} from "../pipeline/layout/graphFlowLayoutComposition";
import {
  type GraphFlowModel,
  GraphVisualizationError,
} from "../pipeline/types";

export const useGraphFlowLayout = (
  visualization: VisualizationByType<"graph">,
) => {
  const [model, setModel] = useState<GraphFlowModel | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [error, setError] = useState<GraphVisualizationError | null>(null);

  const measuredNodes = useNodes();
  const nodesInitialized = useNodesInitialized();
  const layoutApplied = useRef(false);
  const layoutIdRef = useRef(0);
  const latestInput = useRef({ measuredNodes, edges, model });

  useEffect(() => {
    latestInput.current = { measuredNodes, edges, model };
  });

  useEffect(() => {
    layoutApplied.current = false;
    layoutIdRef.current++;

    try {
      const snapshot = createInitialLayoutSnapshot(visualization);
      setModel(snapshot.model);
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setError(snapshot.error);
      setLayoutReady(snapshot.layoutReady);

    } catch (err) {
      const snapshot = createErrorLayoutSnapshot(err);
      setModel(snapshot.model);
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setError(snapshot.error);
      setLayoutReady(snapshot.layoutReady);
    }
  }, [visualization]);

  const hasNodes = nodes.length > 0;

  useEffect(() => {
    if (layoutApplied.current) return;
    if (
      !canRunElkLayout({
        error,
        model,
        hasNodes,
        nodesInitialized,
        measuredNodes,
      })
    ) {
      return;
    }

    layoutApplied.current = true;
    const myLayoutId = layoutIdRef.current;

    const runLayout = async () => {
      const {
        measuredNodes: currentNodes,
        edges: currentEdges,
        model: currentModel,
      } = latestInput.current;

      if (!currentModel) return;

      try {
        const layout = await composeGraphLayout({
          model: currentModel,
          measuredNodes: currentNodes,
          edges: currentEdges,
        });

        if (myLayoutId !== layoutIdRef.current) {
          layoutApplied.current = false;
          return;
        }

        if (!layout) {
          layoutApplied.current = false;
          return;
        }

        setNodes(layout.nodes);
        setEdges(layout.edges);
        setLayoutReady(true);
      } catch (err) {
        layoutApplied.current = false;
        setError(createErrorLayoutSnapshot(err).error);
        setLayoutReady(true);
      }
    };

    void runLayout();
  }, [nodesInitialized, hasNodes, model, error, measuredNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return { nodes, edges, layoutReady, error, onNodesChange };
};
