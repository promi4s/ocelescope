import {
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  useNodes,
  useNodesInitialized,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildGraphFlowModel } from "../model/buildModel";
import {
  composeGraphLayout,
  measuredNodesMatchModel,
  toGraphError,
} from "../model/runLayout";
import type {
  GraphFlowModel,
  GraphVisualization,
  GraphVisualizationError,
} from "../model/types";

type BuildResult =
  | { model: GraphFlowModel; buildError: null }
  | { model: null; buildError: GraphVisualizationError };

const buildSafely = (visualization: GraphVisualization): BuildResult => {
  try {
    return { model: buildGraphFlowModel(visualization), buildError: null };
  } catch (err) {
    return { model: null, buildError: toGraphError(err) };
  }
};

export const useLayout = (visualization: GraphVisualization) => {
  const { model, buildError } = useMemo(
    () => buildSafely(visualization),
    [visualization],
  );

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutError, setLayoutError] =
    useState<GraphVisualizationError | null>(null);

  // Reset whenever the model changes (new prop, or rebuild).
  useEffect(() => {
    setLayoutError(null);
    if (!model) {
      setNodes([]);
      setEdges([]);
      setLayoutReady(true);
      return;
    }
    setNodes(model.nodes);
    setEdges(model.edges);
    setLayoutReady(
      model.layoutPlan.type === "fixed-positions" || model.nodes.length === 0,
    );
  }, [model]);

  // Wait for React Flow to measure nodes, then run ELK.
  const measuredNodes = useNodes();
  const nodesInitialized = useNodesInitialized();

  useEffect(() => {
    if (
      !model ||
      layoutReady ||
      model.layoutPlan.type !== "elk" ||
      !nodesInitialized ||
      !measuredNodesMatchModel(measuredNodes, model)
    ) {
      return;
    }

    let cancelled = false;
    composeGraphLayout({ model, measuredNodes, edges: model.edges }).then(
      (result) => {
        if (cancelled || !result) return;
        setNodes(result.nodes);
        setEdges(result.edges);
        setLayoutReady(true);
      },
      (err) => {
        if (cancelled) return;
        setLayoutError(toGraphError(err));
        setLayoutReady(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [model, layoutReady, nodesInitialized, measuredNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return {
    nodes,
    edges,
    layoutReady,
    error: layoutError ?? buildError,
    onNodesChange,
  };
};
