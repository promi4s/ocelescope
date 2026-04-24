import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { VisualizationByType } from "../../../../types";
import { toDot } from "../../../../hooks/useGraphvizLayout";
import PlaceNode, {
  PLACE_NODE_DIAMETER,
  type PlaceNodeType,
} from "./nodes/PlaceNode";
import TransitionNode, { type TransitionNodeType } from "./nodes/TransitionNode";
import GraphFlowEdge, { type GraphFlowEdgeType } from "./edges/GraphFlowEdge";

// ─── Constants (must match PlaceNode / TransitionNode DOM sizes) ──────────────
const PLACE_DIAMETER = PLACE_NODE_DIAMETER;
const PLACE_WITH_LABEL_HEIGHT = PLACE_NODE_DIAMETER + 28;
const TRANSITION_SILENT_W = 10;
const TRANSITION_SILENT_H = 34;
const TRANSITION_CHAR_WIDTH = 7.5;
const TRANSITION_H_PADDING = 24;
const TRANSITION_HEIGHT = 34;
const TRANSITION_MIN_W = 90;
const TRANSITION_MAX_W = 180;

// ─── Node/edge type maps ──────────────────────────────────────────────────────
const nodeTypes = { place: PlaceNode, transition: TransitionNode };
const edgeTypes = { graphflow: GraphFlowEdge };

// ─── Size estimators ──────────────────────────────────────────────────────────
const estimatePlaceSize = (label: string | null | undefined) => ({
  width: PLACE_DIAMETER,
  height: label ? PLACE_WITH_LABEL_HEIGHT : PLACE_DIAMETER,
});

const estimateTransitionSize = (label: string | null | undefined) => {
  if (!label) return { width: TRANSITION_SILENT_W, height: TRANSITION_SILENT_H };
  const textW = label.length * TRANSITION_CHAR_WIDTH + TRANSITION_H_PADDING * 2;
  return {
    width: Math.max(TRANSITION_MIN_W, Math.min(TRANSITION_MAX_W, textW)),
    height: TRANSITION_HEIGHT,
  };
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type RFNode = PlaceNodeType | TransitionNodeType;
type RFEdge = GraphFlowEdgeType;

type GraphvizJSON = {
  /** "llx,lly,urx,ury" bounding box */
  bb?: string;
  objects?: Array<{
    name?: string;
    pos?: string;
    /** Present on subgraph entries — used to exclude them */
    nodes?: number[];
  }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

const hasPlaceMarking = (label: string | null | undefined, m: "m0=" | "mf=") =>
  label?.includes(m) ?? false;

/**
 * Parse a "x,y" position string and flip Y so Graphviz coordinates
 * (origin bottom-left, Y↑) map to React Flow coordinates (origin top-left, Y↓).
 */
const parsePoint = (value: string | undefined, bbHeight: number): Point | null => {
  if (!value) return null;
  const [xs, ys] = value.split(",");
  const x = Number.parseFloat(xs ?? "");
  const y = Number.parseFloat(ys ?? "");
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y: bbHeight - y };
};

/** Parse the bounding-box height from Graphviz's "llx,lly,urx,ury" string. */
const parseBBHeight = (bb: string | undefined): number => {
  if (!bb) return 0;
  const parts = bb.split(",");
  const ury = Number.parseFloat(parts[3] ?? "0");
  return Number.isFinite(ury) ? ury : 0;
};

// ─── React Flow node/edge builders ───────────────────────────────────────────
function buildRFNodes(visualization: VisualizationByType<"graph">): RFNode[] {
  return (visualization.nodes ?? []).map((node) => {
    const id = node.id ?? "";
    const isPlace = node.shape === "circle";
    const label = node.label ?? null;
    const color = node.color ?? (isPlace ? "#aec6e8" : "#ffffff");

    if (isPlace) {
      return {
        id,
        type: "place" as const,
        position: { x: 0, y: 0 },
        data: {
          label,
          color,
          isFinalMarking:
            (node.layout_attrs as Record<string, unknown> | null)?.["peripheries"] === 2 ||
            hasPlaceMarking(label, "mf="),
          isInitialMarking: hasPlaceMarking(label, "m0="),
        },
      } satisfies PlaceNodeType;
    }

    const { width, height } = estimateTransitionSize(label);
    return {
      id,
      type: "transition" as const,
      position: { x: 0, y: 0 },
      data: { label, color, borderColor: node.border_color ?? null, width, height },
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
        (edge.layout_attrs as Record<string, unknown> | null)?.["style"] === "dashed",
    },
  }));
}

/** Attach explicit node sizes so Graphviz produces accurate spline endpoints. */
function withExplicitSizes(
  visualization: VisualizationByType<"graph">,
): VisualizationByType<"graph"> {
  return {
    ...visualization,
    nodes: (visualization.nodes ?? []).map((node) => {
      if (node.shape === "circle") {
        return { ...node, width: PLACE_DIAMETER, height: PLACE_DIAMETER };
      }
      const { width, height } = estimateTransitionSize(node.label ?? null);
      return { ...node, width, height };
    }),
  };
}

// ─── Inner component ──────────────────────────────────────────────────────────
const GraphFlowInner: React.FC<{
  visualization: VisualizationByType<"graph">;
  isPreview?: boolean | undefined;
}> = ({ visualization, isPreview }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { fitView } = useReactFlow();
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    cancelRef.current = { cancelled: false };

    const rfNodes = buildRFNodes(visualization);
    const rfEdges = buildRFEdges(visualization);
    const dot = toDot(withExplicitSizes(visualization));

    (async () => {
      try {
        const gv = await Graphviz.load();
        const json = gv.layout(dot, "json", visualization.layout_config?.engine ?? "dot");
        const laidOut = JSON.parse(json) as GraphvizJSON;

        if (cancelRef.current.cancelled) return;

        // Flip Y: Graphviz Y↑ → React Flow Y↓
        const bbHeight = parseBBHeight(laidOut.bb);

        // Map safeId → Graphviz center (Y-flipped)
        const nodePositions: Record<string, Point> = {};
        for (const obj of laidOut.objects ?? []) {
          if (!obj.name || !obj.pos || obj.nodes) continue; // skip subgraphs
          const pt = parsePoint(obj.pos, bbHeight);
          if (pt) nodePositions[obj.name] = pt;
        }

        // Position each React Flow node at its Graphviz center (top-left offset)
        const positionedNodes = rfNodes.map((node) => {
          const center = nodePositions[safeId(node.id)];
          const { width } =
            node.type === "place"
              ? estimatePlaceSize(node.data.label)
              : estimateTransitionSize(node.data.label);
          const anchorH =
            node.type === "place"
              ? PLACE_DIAMETER
              : estimateTransitionSize(node.data.label).height;

          return {
            ...node,
            position: center
              ? { x: center.x - width / 2, y: center.y - anchorH / 2 }
              : { x: 0, y: 0 },
          };
        });

        setNodes(positionedNodes as Node[]);
        setEdges(rfEdges as Edge[]);

        requestAnimationFrame(() => {
          if (!cancelRef.current.cancelled) fitView({ padding: 0.15 });
        });
      } catch {
        if (!cancelRef.current.cancelled) {
          // Layout failed — render without positions; floating edges still work
          setNodes(rfNodes as Node[]);
          setEdges(rfEdges as Edge[]);
        }
      }
    })();

    return () => {
      cancelRef.current.cancelled = true;
    };
  }, [visualization, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
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
