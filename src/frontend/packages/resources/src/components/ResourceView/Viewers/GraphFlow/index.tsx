import ELK from "elkjs/lib/elk.bundled.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useNodes,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { VisualizationByType } from "../../../../types";
import PlaceNode, { type PlaceNodeType } from "./nodes/PlaceNode";
import TransitionNode, {
  type TransitionNodeType,
} from "./nodes/TransitionNode";
import StartNode, { type StartNodeType } from "./nodes/StartNode";
import EndNode, { type EndNodeType } from "./nodes/EndNode";
import GraphFlowEdge, { type GraphFlowEdgeType } from "./edges/GraphFlowEdge";

// ─── ELK singleton ────────────────────────────────────────────────────────────
const elk = new ELK();

// ─── Node / edge type maps ────────────────────────────────────────────────────
const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
  start: StartNode,
  end: EndNode,
};
const edgeTypes = { graphflow: GraphFlowEdge };

// ─── Types ────────────────────────────────────────────────────────────────────
type RFNode = PlaceNodeType | TransitionNodeType | StartNodeType | EndNodeType;
type RFEdge = GraphFlowEdgeType;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hasPlaceMarking = (label: string | null | undefined, m: "m0=" | "mf=") =>
  label?.includes(m) ?? false;

/** Map GraphViz rankdir to ELK direction option. */
const rankdirToElkDirection = (rankdir?: string): string => {
  switch (rankdir) {
    case "LR":
      return "RIGHT";
    case "RL":
      return "LEFT";
    case "BT":
      return "UP";
    default:
      return "DOWN"; // TB or unset
  }
};

// ─── Node / edge builders ─────────────────────────────────────────────────────
function buildRFNodes(visualization: VisualizationByType<"graph">): RFNode[] {
  return (visualization.nodes ?? []).map((node) => {
    const id = node.id ?? "";
    const label = node.label ?? null;
    const color = node.color ?? "#aec6e8";

    if (node.shape === "circle") {
      return {
        id,
        type: "place" as const,
        position: { x: 0, y: 0 },
        data: {
          label,
          color,
          isFinalMarking:
            (node.layout_attrs as Record<string, unknown> | null)?.[
              "peripheries"
            ] === 2 || hasPlaceMarking(label, "mf="),
          isInitialMarking: hasPlaceMarking(label, "m0="),
        },
      } satisfies PlaceNodeType;
    }

    if (node.shape === "start") {
      return {
        id,
        type: "start" as const,
        position: { x: 0, y: 0 },
        data: { label, color },
      } satisfies StartNodeType;
    }

    if (node.shape === "end") {
      return {
        id,
        type: "end" as const,
        position: { x: 0, y: 0 },
        data: { label, color },
      } satisfies EndNodeType;
    }

    return {
      id,
      type: "transition" as const,
      position: { x: 0, y: 0 },
      // TransitionNode sizes itself via CSS; React Flow measures the DOM size for ELK.
      data: {
        label,
        color: node.color ?? "#ffffff",
        borderColor: node.border_color ?? null,
      },
    } satisfies TransitionNodeType;
  });
}

function buildRFEdges(visualization: VisualizationByType<"graph">): RFEdge[] {
  return (visualization.edges ?? []).map((edge, i) => ({
    id: edge.id ?? `e${i}`,
    source: edge.source,
    target: edge.target,
    type: "graphflow" as const,
    data: {
      color: edge.color ?? "#555555",
      label: edge.label ?? null,
      isVariable:
        (edge.layout_attrs as Record<string, unknown> | null)?.["style"] ===
        "dashed",
    },
  }));
}

// ─── Inner component (needs ReactFlowProvider ancestor) ───────────────────────
const GraphFlowInner: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
}> = ({ visualization, isPreview }) => {
  const [nodes, setNodes] = useState<Node[]>(
    () => buildRFNodes(visualization) as Node[],
  );
  const [edges, setEdges] = useState<Edge[]>(
    () => buildRFEdges(visualization) as Edge[],
  );

  const { fitView } = useReactFlow();
  // useNodes() returns the internal store's node list, which carries measured sizes
  // after React Flow has rendered and measured each node's DOM element.
  const rfNodes = useNodes();
  const nodesInitialized = useNodesInitialized();

  // Guard: prevent running ELK multiple times for the same set of nodes.
  const elkApplied = useRef(false);

  // Keep a stable ref so the layout effect can read current values without
  // needing them in its own dependency array (avoids infinite loops).
  const latestRef = useRef({ rfNodes, edges, visualization });
  useEffect(() => {
    latestRef.current = { rfNodes, edges, visualization };
  });

  // Reset nodes/edges when the visualization changes.
  useEffect(() => {
    setNodes(buildRFNodes(visualization) as Node[]);
    setEdges(buildRFEdges(visualization) as Edge[]);
    elkApplied.current = false;
    // Resetting nodes to position {0,0} (no measured sizes) causes nodesInitialized
    // to cycle false → true, which re-triggers the layout effect below.
  }, [visualization]);

  // Run ELK once all current nodes have been measured by React Flow.
  // Depends only on nodesInitialized so it fires exactly when the measurement
  // state changes (false → true after nodes are rendered for the first time,
  // or after a visualization reset puts new un-measured nodes into the store).
  useEffect(() => {
    if (!nodesInitialized || elkApplied.current) return;
    elkApplied.current = true;

    const {
      rfNodes: measured,
      edges: currentEdges,
      visualization: vis,
    } = latestRef.current;
    if (measured.length === 0) return;

    const direction = rankdirToElkDirection(
      vis.layout_config?.direction ?? undefined,
    );

    (async () => {
      try {
        const laidOut = await elk.layout({
          id: "root",
          layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": direction,
            "elk.edgeRouting": "ORTHOGONAL",

            "elk.spacing.nodeNode": "50",
            "elk.layered.spacing.nodeNodeBetweenLayers": "80",
            "elk.spacing.edgeEdge": "40",
            "elk.spacing.edgeNode": "25",

            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",

            "elk.edgeLabels.placement": "CENTER",
          },
          children: measured.map((node) => ({
            id: node.id,
            width: node.measured?.width ?? 50,
            height: node.measured?.height ?? 34,
          })),
          edges: currentEdges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
          })),
        });

        const positions: Record<string, { x: number; y: number }> = {};
        for (const child of laidOut.children ?? []) {
          if (child.id && child.x != null && child.y != null) {
            positions[child.id] = { x: child.x, y: child.y };
          }
        }

        setNodes((prev) =>
          prev.map((node) => {
            const pos = positions[node.id];
            return pos ? { ...node, position: pos } : node;
          }),
        );

        requestAnimationFrame(() => fitView({ padding: 0.15 }));
      } catch {
        // ELK layout failed — nodes stay at (0,0); floating edges still render.
        requestAnimationFrame(() => fitView({ padding: 0.15 }));
      }
    })();
  }, [nodesInitialized, fitView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      nodesDraggable={!isPreview}
      nodesConnectable={false}
      elementsSelectable={!isPreview}
      zoomOnScroll={!isPreview}
      panOnDrag={!isPreview}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.05}
      maxZoom={3}
    >
      {!isPreview && (
        <>
          <Background color="#e5e7eb" gap={20} size={1} />
          <Controls showInteractive={false} />
        </>
      )}
    </ReactFlow>
  );
};

// ─── Public component ─────────────────────────────────────────────────────────
const GraphFlow: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
}> = ({ visualization, isPreview }) => (
  <ReactFlowProvider>
    <GraphFlowInner visualization={visualization} isPreview={isPreview} />
  </ReactFlowProvider>
);

export default GraphFlow;
