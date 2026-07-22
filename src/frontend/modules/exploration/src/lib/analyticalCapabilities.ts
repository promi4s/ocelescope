import type { TypedAttribute } from "../api/ocel";

export type AnalyticalType = TypedAttribute["analytical_type"];

export type VisualizationKind = "bar" | "donut" | "histogram" | "line";

const visualizationsByAnalyticalType = {
  categorical: ["bar", "donut"],
  discrete: ["bar", "histogram"],
  continuous: ["histogram"],
  temporal: ["line"],
  unknown: [],
} as const satisfies Record<AnalyticalType, readonly VisualizationKind[]>;

export function compatibleVisualizations(
  analyticalType: AnalyticalType,
): readonly VisualizationKind[] {
  return visualizationsByAnalyticalType[analyticalType];
}
