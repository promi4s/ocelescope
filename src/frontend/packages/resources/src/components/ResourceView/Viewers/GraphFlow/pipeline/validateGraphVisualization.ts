import type {
  BackendGraphEdge,
  BackendGraphNode,
  GraphEdgeArrow,
  GraphEdgeRouting,
  GraphLabelPosition,
  GraphNodeShape,
  GraphVisualization,
} from "./types";
import { GraphVisualizationError } from "./types";

const NODE_SHAPES = new Set<GraphNodeShape>([
  "circle",
  "triangle",
  "rectangle",
  "diamond",
  "hexagon",
]);

const LABEL_POSITIONS = new Set<GraphLabelPosition>([
  "top",
  "center",
  "bottom",
]);

const EDGE_ARROWS = new Set<GraphEdgeArrow>([
  "triangle",
  "circle-triangle",
  "triangle-backcurve",
  "tee",
  "circle",
  "chevron",
  "triangle-tee",
  "triangle-cross",
  "vee",
  "square",
  "diamond",
]);

const EDGE_ROUTINGS = new Set<GraphEdgeRouting>([
  "SPLINES",
  "ORTHOGONAL",
  "POLYLINE",
]);

const EDGE_ROUTING_KEYS = ["elk.edgeRouting", "org.eclipse.elk.edgeRouting"];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasValue = (value: unknown) => value !== undefined && value !== null;

export const normalizeEdgeRouting = (value: unknown): GraphEdgeRouting => {
  if (typeof value !== "string") {
    throw new GraphVisualizationError("Invalid ELK edge routing.", [
      `Expected one of ${Array.from(EDGE_ROUTINGS).join(", ")}, got ${String(value)}.`,
    ]);
  }

  const normalized = value.toUpperCase();
  if (!EDGE_ROUTINGS.has(normalized as GraphEdgeRouting)) {
    throw new GraphVisualizationError("Invalid ELK edge routing.", [
      `Unknown edge routing "${value}". Supported values are ${Array.from(EDGE_ROUTINGS).join(", ")}.`,
    ]);
  }

  return normalized as GraphEdgeRouting;
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

const validateNode = (
  node: BackendGraphNode,
  index: number,
  errors: string[],
) => {
  const prefix = `nodes[${index}]`;

  if (!node.id) {
    errors.push(`${prefix}.id is required.`);
  }

  if (!node.shape || !NODE_SHAPES.has(node.shape)) {
    errors.push(
      `${prefix}.shape must be one of ${Array.from(NODE_SHAPES).join(", ")}.`,
    );
  }

  if (
    hasValue(node.width) &&
    (!isFiniteNumber(node.width) || node.width <= 0)
  ) {
    errors.push(`${prefix}.width must be a positive finite number.`);
  }

  if (
    hasValue(node.height) &&
    (!isFiniteNumber(node.height) || node.height <= 0)
  ) {
    errors.push(`${prefix}.height must be a positive finite number.`);
  }

  if (!hasValue(node.width)) {
    errors.push(`${prefix}.width is required for all nodes.`);
  }

  if (!hasValue(node.height)) {
    errors.push(`${prefix}.height is required for all nodes.`);
  }

  const hasX = hasValue(node.x);
  const hasY = hasValue(node.y);
  if (hasX !== hasY) {
    errors.push(`${prefix} must provide both x and y, or neither.`);
  }
  if (hasX && !isFiniteNumber(node.x)) {
    errors.push(`${prefix}.x must be a finite number.`);
  }
  if (hasY && !isFiniteNumber(node.y)) {
    errors.push(`${prefix}.y must be a finite number.`);
  }

  if (node.label_pos && !LABEL_POSITIONS.has(node.label_pos)) {
    errors.push(
      `${prefix}.label_pos must be one of ${Array.from(LABEL_POSITIONS).join(", ")}.`,
    );
  }

  if (
    node.rank !== undefined &&
    node.rank !== null &&
    node.rank !== "source" &&
    node.rank !== "sink" &&
    !isFiniteNumber(node.rank)
  ) {
    errors.push(`${prefix}.rank must be "source", "sink", a number, or null.`);
  }

  if (
    node.style?.inner_symbol !== undefined &&
    node.style.inner_symbol !== null &&
    node.style.inner_symbol !== "triangle" &&
    node.style.inner_symbol !== "square"
  ) {
    errors.push(
      `${prefix}.style.inner_symbol must be "triangle", "square", or null.`,
    );
  }

  if (
    node.style?.initial_tokens !== undefined &&
    node.style.initial_tokens !== null &&
    (!Number.isInteger(node.style.initial_tokens) ||
      node.style.initial_tokens < 1)
  ) {
    errors.push(`${prefix}.style.initial_tokens must be a positive integer.`);
  }

  if (
    node.style?.final_tokens !== undefined &&
    node.style.final_tokens !== null &&
    (!Number.isInteger(node.style.final_tokens) || node.style.final_tokens < 1)
  ) {
    errors.push(`${prefix}.style.final_tokens must be a positive integer.`);
  }
};

const validateEdge = (
  edge: BackendGraphEdge,
  index: number,
  nodeIds: Set<string>,
  errors: string[],
) => {
  const prefix = `edges[${index}]`;

  if (!edge.id) {
    errors.push(`${prefix}.id is required.`);
  }

  if (!edge.source) {
    errors.push(`${prefix}.source is required.`);
  } else if (!nodeIds.has(edge.source)) {
    errors.push(`${prefix}.source references unknown node "${edge.source}".`);
  }

  if (!edge.target) {
    errors.push(`${prefix}.target is required.`);
  } else if (!nodeIds.has(edge.target)) {
    errors.push(`${prefix}.target references unknown node "${edge.target}".`);
  }

  if (
    edge.start_arrow !== undefined &&
    edge.start_arrow !== null &&
    !EDGE_ARROWS.has(edge.start_arrow)
  ) {
    errors.push(
      `${prefix}.start_arrow must be one of ${Array.from(EDGE_ARROWS).join(", ")}, or null.`,
    );
  }

  if (
    edge.end_arrow !== undefined &&
    edge.end_arrow !== null &&
    !EDGE_ARROWS.has(edge.end_arrow)
  ) {
    errors.push(
      `${prefix}.end_arrow must be one of ${Array.from(EDGE_ARROWS).join(", ")}, or null.`,
    );
  }
};

export const validateGraphVisualization = (
  visualization: GraphVisualization,
) => {
  const errors: string[] = [];
  const nodes = visualization.nodes ?? [];
  const edges = visualization.edges ?? [];

  nodes.forEach((node, index) => {
    validateNode(node, index, errors);
  });

  const nodeIds = new Set(nodes.flatMap((node) => (node.id ? [node.id] : [])));
  edges.forEach((edge, index) => {
    validateEdge(edge, index, nodeIds, errors);
  });

  const nodesWithPosition = nodes.filter(
    (node) => hasValue(node.x) || hasValue(node.y),
  );
  if (
    nodesWithPosition.length > 0 &&
    nodesWithPosition.length !== nodes.length
  ) {
    errors.push(
      "Graph nodes must either all provide fixed x/y positions or all use ELK layout.",
    );
  }

  const elkOptions = visualization.layout_config?.elk_options ?? {};
  if (elkOptions && typeof elkOptions === "object") {
    try {
      getConfiguredEdgeRouting(elkOptions);
    } catch (error) {
      if (error instanceof GraphVisualizationError) {
        errors.push(error.message, ...(error.details ?? []));
      } else {
        errors.push("Invalid ELK layout options.");
      }
    }
  }

  if (
    nodesWithPosition.length === nodes.length &&
    nodes.length > 0 &&
    Object.keys(elkOptions).length > 0
  ) {
    errors.push(
      "Graph provides fixed node positions and ELK layout options. Remove one so the renderer does not ignore backend parameters.",
    );
  }

  if (errors.length > 0) {
    throw new GraphVisualizationError(
      "Graph visualization is invalid.",
      errors,
    );
  }
};
