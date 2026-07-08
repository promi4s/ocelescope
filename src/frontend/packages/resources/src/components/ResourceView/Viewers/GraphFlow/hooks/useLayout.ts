import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyLayout, createLayout } from "../layout";
import { buildGraphFlowModel } from "../model/buildModel";
import {
  type GraphFlowEdgeType,
  type GraphFlowModel,
  type GraphFlowNodeType,
  type GraphVisualization,
  type GraphVisualizationError,
  toGraphError,
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

  const [nodes, setNodes] = useState<GraphFlowNodeType[]>([]);
  const [edges, setEdges] = useState<GraphFlowEdgeType[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutError, setLayoutError] =
    useState<GraphVisualizationError | null>(null);

  useEffect(() => {
    setLayoutError(null);

    if (buildError || !model) {
      setNodes([]);
      setEdges([]);
      setLayoutReady(true);
      return;
    }

    // Mount the (still unpositioned) nodes so React Flow measures them while the
    // engine runs; the canvas stays hidden until `layoutReady` flips. Empty
    // graphs have nothing to lay out.
    setNodes(model.nodes);
    setEdges(model.edges);
    if (model.nodes.length === 0) {
      setLayoutReady(true);
      return;
    }
    setLayoutReady(false);

    let cancelled = false;
    createLayout(model)
      .run()
      .then(
        (result) => {
          if (cancelled) return;
          const laidOut = applyLayout(model, result);
          setNodes(laidOut.nodes);
          setEdges(laidOut.edges);
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
  }, [model, buildError]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphFlowNodeType>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  return {
    nodes,
    edges,
    layoutReady,
    error: buildError ?? layoutError,
    onNodesChange,
  };
};
