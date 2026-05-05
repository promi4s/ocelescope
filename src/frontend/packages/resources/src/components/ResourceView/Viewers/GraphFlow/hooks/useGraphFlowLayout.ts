import {
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  useNodes,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VisualizationByType } from "../../../../../types";
import { FIT_VIEW_PADDING } from "../constants/graphFlow";
import {
  applyEdgeLayouts,
  applyNodePositions,
} from "../pipeline/applyGraphLayout";
import { createGraphFlowModel } from "../pipeline/createGraphFlowModel";
import { layoutGraphFlowModel } from "../pipeline/layoutGraphFlowModel";
import {
  type GraphFlowModel,
  GraphVisualizationError,
} from "../pipeline/types";

const toGraphError = (error: unknown): GraphVisualizationError => {
  if (error instanceof GraphVisualizationError) {
    return error;
  }

  return new GraphVisualizationError("Graph layout failed.", [
    error instanceof Error ? error.message : String(error),
  ]);
};

const measuredNodesMatchModel = (
  measuredNodes: Node[],
  model: GraphFlowModel,
) => {
  if (measuredNodes.length !== model.nodes.length) return false;

  const measuredNodeIds = new Set(measuredNodes.map((node) => node.id));
  return model.nodes.every((node) => measuredNodeIds.has(node.id));
};

export const useGraphFlowLayout = (
  visualization: VisualizationByType<"graph">,
) => {
  const [model, setModel] = useState<GraphFlowModel | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [error, setError] = useState<GraphVisualizationError | null>(null);

  const { fitView } = useReactFlow();
  const measuredNodes = useNodes();
  const nodesInitialized = useNodesInitialized();
  const layoutApplied = useRef(false);
  const layoutIdRef = useRef(0);
  const latestInput = useRef({ measuredNodes, edges, model });

  // Keep latest input in sync every render
  useEffect(() => {
    latestInput.current = { measuredNodes, edges, model };
  });

  // Reset when visualization changes
  useEffect(() => {
    layoutApplied.current = false;
    layoutIdRef.current++;

    try {
      const nextModel = createGraphFlowModel(visualization);
      setModel(nextModel);
      setNodes(nextModel.nodes);
      setEdges(nextModel.edges);
      setError(null);
      setLayoutReady(
        nextModel.layoutPlan.type === "fixed-positions" ||
          nextModel.nodes.length === 0,
      );

      if (nextModel.layoutPlan.type === "fixed-positions") {
        requestAnimationFrame(() => fitView({ padding: FIT_VIEW_PADDING }));
      }
    } catch (err) {
      setModel(null);
      setNodes([]);
      setEdges([]);
      setError(toGraphError(err));
      setLayoutReady(true);
    }
  }, [fitView, visualization]);

  const hasNodes = nodes.length > 0;

  // Run ELK layout once nodes are measured (or immediately when there are none)
  useEffect(() => {
    if (error || !model || model.layoutPlan.type !== "elk") return;
    if (layoutApplied.current) return;
    if (hasNodes && !nodesInitialized) return;
    if (hasNodes && !measuredNodesMatchModel(measuredNodes, model)) return;
    layoutApplied.current = true;

    const myLayoutId = layoutIdRef.current;

    const runLayout = async () => {
      const {
        measuredNodes: currentNodes,
        edges: currentEdges,
        model: currentModel,
      } = latestInput.current;

      if (!currentModel || currentModel.nodes.length === 0) {
        setLayoutReady(true);
        return;
      }

      if (
        currentNodes.length === 0 ||
        !measuredNodesMatchModel(currentNodes, currentModel)
      ) {
        layoutApplied.current = false;
        return;
      }

      try {
        const layout = await layoutGraphFlowModel({
          model: currentModel,
          measuredNodes: currentNodes,
          edges: currentEdges,
        });

        // Discard result if visualization changed while ELK was running
        if (myLayoutId !== layoutIdRef.current) {
          layoutApplied.current = false;
          return;
        }

        if (layout) {
          setNodes((current) => applyNodePositions(current, layout.positions));
          setEdges((current) => applyEdgeLayouts(current, layout.edgeLayouts));
        }

        setLayoutReady(true);
        requestAnimationFrame(() => fitView({ padding: FIT_VIEW_PADDING }));
      } catch (err) {
        layoutApplied.current = false;
        setError(toGraphError(err));
        setLayoutReady(true);
      }
    };

    void runLayout();
  }, [fitView, nodesInitialized, hasNodes, model, error, measuredNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return { nodes, edges, layoutReady, error, onNodesChange };
};
