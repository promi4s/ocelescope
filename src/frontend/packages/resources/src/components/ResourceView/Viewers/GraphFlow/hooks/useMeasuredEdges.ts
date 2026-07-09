import { useNodesInitialized, useUpdateNodeInternals } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import type { GraphFlowEdgeType, GraphFlowNodeType } from "../model/types";

const nodeLayoutKey = (nodes: GraphFlowNodeType[]) =>
  nodes
    .map((node) =>
      [
        node.id,
        node.position.x,
        node.position.y,
        node.data.width ?? "",
        node.data.height ?? "",
        node.data.shape ?? "",
      ].join(":"),
    )
    .join("|");

export const useMeasuredEdges = ({
  nodes,
  edges,
  layoutReady,
}: {
  nodes: GraphFlowNodeType[];
  edges: GraphFlowEdgeType[];
  layoutReady: boolean;
}) => {
  const nodesInitialized = useNodesInitialized();
  const currentNodeLayoutKey = useMemo(() => nodeLayoutKey(nodes), [nodes]);
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const updateNodeInternals = useUpdateNodeInternals();
  const [releasedNodeLayoutKey, setReleasedNodeLayoutKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!layoutReady || !nodesInitialized || nodes.length === 0) {
      setReleasedNodeLayoutKey(null);
      return;
    }

    // React Flow can keep stale handle bounds for one render after a fast
    // layout swap. Force a node-internals refresh before edges enter the store.
    let releaseFrame: number | null = null;
    const updateFrame = requestAnimationFrame(() => {
      updateNodeInternals(nodeIds);
      releaseFrame = requestAnimationFrame(() => {
        setReleasedNodeLayoutKey(currentNodeLayoutKey);
      });
    });

    return () => {
      cancelAnimationFrame(updateFrame);
      if (releaseFrame != null) cancelAnimationFrame(releaseFrame);
    };
  }, [
    layoutReady,
    nodesInitialized,
    currentNodeLayoutKey,
    nodeIds,
    nodes.length,
    updateNodeInternals,
  ]);

  if (
    !layoutReady ||
    !nodesInitialized ||
    releasedNodeLayoutKey !== currentNodeLayoutKey
  ) {
    return [];
  }

  return edges;
};
