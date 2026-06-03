import type { GraphEdgeRouting } from "./types";
import {
  GraphVisualizationError,
  isGraphEdgeRouting,
  SUPPORTED_EDGE_ROUTING,
} from "./types";

const EDGE_ROUTING_KEYS = ["elk.edgeRouting", "org.eclipse.elk.edgeRouting"];

export const normalizeEdgeRouting = (value: unknown): GraphEdgeRouting => {
  if (typeof value !== "string") {
    throw new GraphVisualizationError("Invalid ELK edge routing.", [
      `Expected one of ${Array.from(SUPPORTED_EDGE_ROUTING).join(", ")}, got ${String(value)}.`,
    ]);
  }

  const normalized = value.toUpperCase();
  if (!isGraphEdgeRouting(normalized)) {
    throw new GraphVisualizationError("Invalid ELK edge routing.", [
      `Unknown edge routing "${value}". Supported values are ${Array.from(SUPPORTED_EDGE_ROUTING).join(", ")}.`,
    ]);
  }

  return normalized;
};

export const getConfiguredEdgeRouting = (
  elkOptions: Record<string, string | number | boolean>,
): GraphEdgeRouting => {
  const configured = EDGE_ROUTING_KEYS.find((key) => {
    const value = elkOptions[key];
    return typeof value === "string" && isGraphEdgeRouting(value.toUpperCase());
  });

  return configured ? normalizeEdgeRouting(elkOptions[configured]) : "POLYLINE";
};

export const normalizeElkOptions = (
  elkOptions: Record<string, string | number | boolean>,
) => {
  const edgeRouting = getConfiguredEdgeRouting(elkOptions);
  const normalizedOptions = { ...elkOptions };

  for (const key of EDGE_ROUTING_KEYS) {
    if (key in normalizedOptions) {
      normalizedOptions[key] = edgeRouting;
    }
  }

  return { edgeRouting, elkOptions: normalizedOptions };
};
