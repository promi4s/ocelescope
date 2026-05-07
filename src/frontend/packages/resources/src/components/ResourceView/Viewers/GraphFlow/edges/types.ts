import type { Edge } from "@xyflow/react";
import type { GraphPoint } from "../pipeline/types";

export type EdgeArrow =
  | "triangle"
  | "circle-triangle"
  | "triangle-backcurve"
  | "tee"
  | "circle"
  | "chevron"
  | "triangle-tee"
  | "triangle-cross"
  | "vee"
  | "square"
  | "diamond"
  | null;

export type GraphFlowEdgeData = {
  color: string;
  label?: string | null;
  dashed: boolean;
  bold: boolean;
  startArrow?: EdgeArrow;
  endArrow?: EdgeArrow;
  startLabel?: string | null;
  endLabel?: string | null;
  annotation?: { type?: string } | null;
  path?: string | null;
  labelPosition?: GraphPoint | null;
  startPoint?: GraphPoint | null;
  endPoint?: GraphPoint | null;
};

export type GraphFlowEdgeType = Edge<GraphFlowEdgeData, "graphflow">;
