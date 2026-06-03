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
  const configured = EDGE_ROUTING_KEYS.flatMap((key) =>
    key in elkOptions ? [{ key, value: elkOptions[key] }] : [],
  );

  if (configured.length === 0) {
    return "POLYLINE";
  }

  const routings = configured.map(({ value }) => normalizeEdgeRouting(value));
  const distinct = new Set(routings);

  if (distinct.size > 1) {
    throw new GraphVisualizationError("Conflicting ELK edge routing options.", [
      configured.map(({ key, value }) => `${key}=${String(value)}`).join(", "),
    ]);
  }

  return routings[0] ?? "POLYLINE";
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
