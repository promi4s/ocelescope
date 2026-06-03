import type { GraphEdge } from "@ocelescope/api-base";
import type { Edge } from "@xyflow/react";
import type { GraphPoint } from "../pipeline/types";

type Point = {
  x: number;
  y: number;
};

export type GraphFlowEdgeType = Edge<
  (GraphEdge & {
    startPoint?: GraphPoint | null;
    endPoint?: GraphPoint | null;
    path?: string | null;
    labelPosition?: Point | null;
  }) &
    Record<string, unknown>,
  "graphflow"
>;
