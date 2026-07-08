import { useNodesInitialized } from "@xyflow/react";
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
  const [releasedNodeLayoutKey, setReleasedNodeLayoutKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!layoutReady || !nodesInitialized || nodes.length === 0) {
      setReleasedNodeLayoutKey(null);
      return;
    }

    // React Flow can report the previous node set as initialized for one render
    // after a layout swap. Delay edge release until the new nodes have committed.
    const frame = requestAnimationFrame(() => {
      setReleasedNodeLayoutKey(currentNodeLayoutKey);
    });

    return () => cancelAnimationFrame(frame);
  }, [layoutReady, nodesInitialized, currentNodeLayoutKey, nodes.length]);

  if (
    !layoutReady ||
    !nodesInitialized ||
    releasedNodeLayoutKey !== currentNodeLayoutKey
  ) {
    return [];
  }

  return edges;
};
