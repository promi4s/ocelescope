export const DEFAULT_NODE_POSITION = { x: 0, y: 0 } as const;

export const DEFAULT_COLORS = {
  edge: "#555555",
  place: "#aec6e8",
  transition: "#ffffff",
  transitionBorder: "#333",
  text: "#1a1a1a",
} as const;

export const PLACE_NODE_DIAMETER = 44;
export const MARKING_DOT_SIZE = 12;
export const TERMINAL_NODE_SIZE = 32;
export const TRANSITION_HEIGHT = 34;

export const FIT_VIEW_PADDING = 0.15;

export const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.spacing.nodeNode": "50",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.spacing.edgeEdge": "40",
  "elk.spacing.edgeNode": "25",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.edgeLabels.placement": "CENTER",
} as const;
