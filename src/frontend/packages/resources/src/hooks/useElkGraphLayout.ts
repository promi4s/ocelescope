import type { ElementDefinition } from "cytoscape";
import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import { isNil, omitBy } from "lodash";
import { useEffect, useRef, useState } from "react";
import type { VisualizationByType } from "../types/index";

const elk = new ELK();

// Strip characters that would break Cytoscape element IDs
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

// Approximate character width at 14px font, used for label-based size estimates
const CHAR_WIDTH = 7.5;
const H_PADDING = 24;
const DEFAULT_HEIGHT = 34;
const CIRCLE_SIZE = 40;

const estimateNodeSize = (node: {
  id?: string | null;
  label?: string | null;
  width?: number | null;
  height?: number | null;
  shape?: string | null;
}) => {
  const isCircle = node.shape === "circle";
  if (isCircle) {
    const size = node.width ?? node.height ?? CIRCLE_SIZE;
    return { width: size, height: size };
  }
  const label = node.label ?? node.id ?? "";
  const width = node.width ?? Math.max(80, label.length * CHAR_WIDTH + H_PADDING * 2);
  const height = node.height ?? DEFAULT_HEIGHT;
  return { width, height };
};

// Map backend rankdir to ELK direction
const toElkDirection = (rankdir?: string) => {
  switch (rankdir) {
    case "TB": return "DOWN";
    case "BT": return "UP";
    case "RL": return "LEFT";
    default:   return "RIGHT"; // LR or unset
  }
};

export const useElkGraphLayout = (
  visualization: VisualizationByType<"graph">,
) => {
  const [elements, setElements] = useState<ElementDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    cancelRef.current.cancelled = false;
    setError(null);

    const nodes = visualization.nodes ?? [];
    const edges = visualization.edges ?? [];

    const rankdir = (visualization.layout_config?.graphAttrs as Record<string, string> | undefined)?.rankdir;
    const direction = toElkDirection(rankdir);

    // Build node size map — used both for ELK input and Cytoscape data
    const nodeSizes: Record<string, { width: number; height: number }> = {};
    for (const node of nodes) {
      nodeSizes[safeId(node.id ?? "")] = estimateNodeSize(node);
    }

    const elkGraph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": direction,

        // Spacing
        "elk.spacing.nodeNode": "50",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
        "elk.spacing.edgeNode": "25",
        "elk.spacing.edgeEdge": "15",

        // Edge routing
        "elk.edgeRouting": "SPLINES",

        // Node placement
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",

        // Reduce edge crossings
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      },
      children: nodes.map((node) => {
        const id = safeId(node.id ?? "");
        const { width, height } = nodeSizes[id] ?? { width: 80, height: DEFAULT_HEIGHT };
        return { id, width, height };
      }),
      edges: edges.map((edge, i) => ({
        id: `e${i}`,
        sources: [safeId(edge.source ?? "")],
        targets: [safeId(edge.target ?? "")],
      })),
    };

    // ELK positions are top-left; Cytoscape needs center
    elk
      .layout(elkGraph)
      .then((laidOut) => {
        if (cancelRef.current.cancelled) return;

        const posMap: Record<string, { x: number; y: number }> = {};
        for (const child of laidOut.children ?? []) {
          posMap[child.id] = {
            x: (child.x ?? 0) + (child.width ?? 0) / 2,
            y: (child.y ?? 0) + (child.height ?? 0) / 2,
          };
        }

        const cyNodes: ElementDefinition[] = nodes.map((node) => {
          const id = safeId(node.id ?? "");
          const { width, height } = nodeSizes[id] ?? { width: 80, height: DEFAULT_HEIGHT };
          return {
            data: {
              ...omitBy(node, isNil),
              label: node.label ?? "",
              shape: node.shape === "circle" ? "ellipse" : (node.shape ?? "rectangle"),
              width,
              height,
            },
            position: posMap[id] ?? { x: 0, y: 0 },
          };
        });

        const cyEdges: ElementDefinition[] = edges.map((edge) => ({
          data: omitBy(edge, isNil),
        }));

        setElements([...cyNodes, ...cyEdges]);
      })
      .catch((e: unknown) => {
        if (!cancelRef.current.cancelled) {
          setError(
            e instanceof Error ? e.message : "ELK layout failed.",
          );
        }
      });

    return () => {
      cancelRef.current.cancelled = true;
    };
  }, [visualization]);

  return { elements, error };
};
