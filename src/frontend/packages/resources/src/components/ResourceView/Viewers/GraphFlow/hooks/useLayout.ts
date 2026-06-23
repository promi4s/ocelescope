import {
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildGraphFlowModel } from "../model/buildModel";
import { toGraphError } from "../model/runLayout";
import type {
  GraphFlowModel,
  GraphVisualization,
  GraphVisualizationError,
} from "../model/types";
import { type ElkGraphFlowModel, useElkLayout } from "./useElkLayout";
import {
  type GraphvizGraphFlowModel,
  useGraphvizLayout,
} from "./useGraphvizLayout";

type BuildResult =
  | { model: GraphFlowModel; buildError: null }
  | { model: null; buildError: GraphVisualizationError };

type LayoutResult = {
  nodes: Node[];
  edges: Edge[];
};

const buildSafely = (visualization: GraphVisualization): BuildResult => {
  try {
    return { model: buildGraphFlowModel(visualization), buildError: null };
  } catch (err) {
    return { model: null, buildError: toGraphError(err) };
  }
};

const isElkModel = (model: GraphFlowModel): model is ElkGraphFlowModel =>
  model.layoutPlan.type === "elk";

const isGraphvizModel = (
  model: GraphFlowModel,
): model is GraphvizGraphFlowModel => model.layoutPlan.type === "graphviz";

export const useLayout = (visualization: GraphVisualization) => {
  const { model, buildError } = useMemo(
    () => buildSafely(visualization),
    [visualization],
  );
  const runElkLayout = useElkLayout();
  const runGraphvizLayout = useGraphvizLayout(visualization);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutError, setLayoutError] =
    useState<GraphVisualizationError | null>(null);

  useEffect(() => {
    setLayoutError(null);
    setNodes(model?.nodes ?? []);
    setEdges(model?.edges ?? []);
    setLayoutReady(!model || model.nodes.length === 0);
  }, [model]);

  useEffect(() => {
    if (!model || buildError || layoutReady) return;

    let cancelled = false;
    const layoutPromise: Promise<LayoutResult | null> = isElkModel(model)
      ? runElkLayout(model)
      : isGraphvizModel(model)
        ? runGraphvizLayout(model)
        : Promise.resolve(null);

    layoutPromise.then(
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
  }, [model, buildError, layoutReady, runElkLayout, runGraphvizLayout]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
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
