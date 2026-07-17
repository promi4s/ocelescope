import type { AttributeSchemaItem } from "../api/querying";

export type AnalyticalType = AttributeSchemaItem["analytical_type"];
export type PhysicalType = AttributeSchemaItem["physical_type"];

export type VisualizationKind = "bar" | "donut" | "histogram" | "line";

const analyticalTypesByPhysicalType = {
  number: ["discrete", "continuous", "categorical"],
  string: ["categorical"],
  boolean: ["categorical"],
  datetime: ["temporal", "categorical"],
  unknown: ["unknown", "categorical"],
} as const satisfies Record<PhysicalType, readonly AnalyticalType[]>;

const visualizationsByAnalyticalType = {
  categorical: ["bar", "donut"],
  discrete: ["bar", "histogram"],
  continuous: ["histogram"],
  temporal: ["line"],
  unknown: [],
} as const satisfies Record<AnalyticalType, readonly VisualizationKind[]>;

export function supportedAnalyticalTypes(
  physicalType: PhysicalType,
): readonly AnalyticalType[] {
  return analyticalTypesByPhysicalType[physicalType];
}

export function compatibleVisualizations(
  analyticalType: AnalyticalType,
): readonly VisualizationKind[] {
  return visualizationsByAnalyticalType[analyticalType];
}
