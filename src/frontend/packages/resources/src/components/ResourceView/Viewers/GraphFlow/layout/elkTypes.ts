export type ElkPoint = { x: number; y: number };

export type ElkEdgeSection = {
  startPoint?: ElkPoint;
  bendPoints?: ElkPoint[];
  endPoint?: ElkPoint;
};

export type ElkEdgeLabel = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type ElkEdgeResult = {
  id?: string;
  sections?: ElkEdgeSection[];
  labels?: ElkEdgeLabel[];
  layoutOptions?: Record<string, unknown>;
};
