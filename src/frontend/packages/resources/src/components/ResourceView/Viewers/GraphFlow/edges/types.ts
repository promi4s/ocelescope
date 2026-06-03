import type { GraphEdge } from "@ocelescope/api-base";
import type { Edge } from "@xyflow/react";

type Point = {
  x: number;
  y: number;
};

export type GraphFlowEdgeType = Edge<
  (GraphEdge & {
    startPoint: Point;
    endPoint: Point;
    path: string;
    labelPosition: Point;
  }) &
    Record<string, unknown>,
  "graphflow"
>;
