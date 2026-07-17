import type {
  OcelFieldSchema,
  OcelSchemaResponse,
} from "@ocelescope/api-querying";
import type { AnalysisQuery, OcelSource, TimeUnit } from "./analysisQuery";
import { fieldExpression, getSourceSchema } from "./analysisQuery";
import type { ChartType } from "./chartSpec";

export type DimensionExpressionId =
  | "event.activity"
  | "event.timestamp"
  | "event.attribute"
  | "object.type"
  | "object.attribute"
  | "e2o.activity"
  | "e2o.object_type"
  | "e2o.qualifier";

export type MeasureExpressionId =
  | "count.events"
  | "count.objects"
  | "count.e2o"
  | "count.o2o"
  | "count.object_changes";

export interface SemanticParameters {
  activity?: string;
  objectType?: string;
  attribute?: string;
  timeUnit?: TimeUnit;
  bins?: number;
}

export interface DimensionSelection {
  id: DimensionExpressionId;
  parameters: SemanticParameters;
}

export interface MeasureSelection {
  id: MeasureExpressionId;
}

export interface SemanticChartSelection {
  dimension?: DimensionSelection;
  measure: MeasureSelection;
  series?: DimensionSelection;
}

export interface DimensionExpressionDefinition {
  id: DimensionExpressionId;
  label: string;
  source: OcelSource;
  chartTypes: ChartType[];
  parameter: "none" | "event_attribute" | "object_attribute" | "time";
}

export interface MeasureExpressionDefinition {
  id: MeasureExpressionId;
  label: string;
  source: OcelSource;
}

export const DIMENSION_EXPRESSIONS: DimensionExpressionDefinition[] = [
  {
    id: "event.activity",
    label: "Event activity",
    source: "events",
    chartTypes: ["bar", "pie"],
    parameter: "none",
  },
  {
    id: "event.timestamp",
    label: "Event timestamp",
    source: "events",
    chartTypes: ["bar", "line", "area"],
    parameter: "time",
  },
  {
    id: "event.attribute",
    label: "Event attribute",
    source: "events",
    chartTypes: ["bar", "line", "area", "pie", "histogram"],
    parameter: "event_attribute",
  },
  {
    id: "object.type",
    label: "Object type",
    source: "objects",
    chartTypes: ["bar", "pie"],
    parameter: "none",
  },
  {
    id: "object.attribute",
    label: "Object attribute",
    source: "objects",
    chartTypes: ["bar", "line", "area", "pie", "histogram"],
    parameter: "object_attribute",
  },
  {
    id: "e2o.activity",
    label: "Relation event activity",
    source: "e2o",
    chartTypes: ["bar", "pie"],
    parameter: "none",
  },
  {
    id: "e2o.object_type",
    label: "Relation object type",
    source: "e2o",
    chartTypes: ["bar", "pie"],
    parameter: "none",
  },
  {
    id: "e2o.qualifier",
    label: "Relation qualifier",
    source: "e2o",
    chartTypes: ["bar", "pie"],
    parameter: "none",
  },
];

export const MEASURE_EXPRESSIONS: MeasureExpressionDefinition[] = [
  { id: "count.events", label: "Number of events", source: "events" },
  { id: "count.objects", label: "Number of objects", source: "objects" },
  {
    id: "count.e2o",
    label: "Number of event-object relations",
    source: "e2o",
  },
  {
    id: "count.o2o",
    label: "Number of object-object relations",
    source: "o2o",
  },
  {
    id: "count.object_changes",
    label: "Number of object changes",
    source: "object_changes",
  },
];

export function getDimensionDefinition(id: DimensionExpressionId) {
  const definition = DIMENSION_EXPRESSIONS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown dimension expression '${id}'`);
  return definition;
}

export function getMeasureDefinition(id: MeasureExpressionId) {
  const definition = MEASURE_EXPRESSIONS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown measure expression '${id}'`);
  return definition;
}

export function dimensionsForChart(type: ChartType) {
  return DIMENSION_EXPRESSIONS.filter((item) => item.chartTypes.includes(type));
}

export function measuresForSource(source?: OcelSource) {
  return source
    ? MEASURE_EXPRESSIONS.filter((item) => item.source === source)
    : MEASURE_EXPRESSIONS;
}

function fieldTypeAllowed(type: OcelFieldSchema["type"], chartType: ChartType) {
  if (chartType === "histogram") return type === "number";
  if (chartType === "line" || chartType === "area") {
    return type === "datetime" || type === "number";
  }
  if (chartType === "pie") return type === "string" || type === "boolean";
  return type !== "unknown";
}

export function semanticAttributes(
  schema: OcelSchemaResponse,
  source: "events" | "objects",
  entityType: string | undefined,
  chartType: ChartType,
) {
  return (
    getSourceSchema(schema, source)?.fields.filter(
      (field) =>
        field.role === "attribute" &&
        fieldTypeAllowed(field.type, chartType) &&
        (!entityType ||
          field.entity_types.length === 0 ||
          field.entity_types.includes(entityType)),
    ) ?? []
  );
}

export function defaultDimensionSelection(
  schema: OcelSchemaResponse,
  chartType: ChartType,
): DimensionSelection | undefined {
  if (chartType === "kpi") return undefined;
  if (chartType === "histogram") {
    const events = getSourceSchema(schema, "events");
    const activity = events?.entity_types.find(
      (candidate) =>
        semanticAttributes(schema, "events", candidate, chartType).length > 0,
    );
    const attribute = semanticAttributes(
      schema,
      "events",
      activity,
      chartType,
    )[0]?.name;
    return {
      id: "event.attribute",
      parameters: { activity, attribute, bins: 20 },
    };
  }
  if (chartType === "line" || chartType === "area") {
    return { id: "event.timestamp", parameters: { timeUnit: "day" } };
  }
  return { id: "event.activity", parameters: {} };
}

export function countMeasureForSource(source: OcelSource): MeasureSelection {
  const definition = MEASURE_EXPRESSIONS.find((item) => item.source === source);
  return { id: definition?.id ?? "count.events" };
}

export function defaultSemanticSelection(
  schema: OcelSchemaResponse,
  chartType: ChartType,
): SemanticChartSelection {
  const dimension = defaultDimensionSelection(schema, chartType);
  const source = dimension
    ? getDimensionDefinition(dimension.id).source
    : "events";
  return {
    dimension,
    measure: countMeasureForSource(source),
  };
}

export function dimensionField(
  schema: OcelSchemaResponse,
  selection: DimensionSelection,
): string | undefined {
  const definition = getDimensionDefinition(selection.id);
  const source = getSourceSchema(schema, definition.source);
  if (selection.id === "event.activity") return source?.type_field ?? undefined;
  if (selection.id === "event.timestamp") {
    return source?.timestamp_field ?? undefined;
  }
  if (
    selection.id === "event.attribute" ||
    selection.id === "object.attribute"
  ) {
    return selection.parameters.attribute;
  }
  if (selection.id === "object.type") return source?.type_field ?? undefined;
  if (selection.id === "e2o.activity") return "ocel:activity";
  if (selection.id === "e2o.object_type") return "ocel:type";
  return "ocel:qualifier";
}

export function buildSemanticQuery(
  schema: OcelSchemaResponse,
  chartType: ChartType,
  selection: SemanticChartSelection,
): AnalysisQuery {
  const measureDefinition = getMeasureDefinition(selection.measure.id);
  const dimensionDefinition = selection.dimension
    ? getDimensionDefinition(selection.dimension.id)
    : undefined;
  const source = dimensionDefinition?.source ?? measureDefinition.source;
  const dimensionName = selection.dimension
    ? dimensionField(schema, selection.dimension)
    : undefined;
  const seriesName = selection.series
    ? dimensionField(schema, selection.series)
    : undefined;
  const sourceSchema = getSourceSchema(schema, source);
  const predicates = [] as AnalysisQuery["predicates"];

  if (selection.dimension?.id === "event.attribute") {
    const activity = selection.dimension.parameters.activity;
    if (activity && sourceSchema?.type_field) {
      predicates.push({
        field: sourceSchema.type_field,
        operator: "eq",
        value: activity,
      });
    }
  }
  if (selection.dimension?.id === "object.attribute") {
    const objectType = selection.dimension.parameters.objectType;
    if (objectType && sourceSchema?.type_field) {
      predicates.push({
        field: sourceSchema.type_field,
        operator: "eq",
        value: objectType,
      });
    }
  }

  return {
    source,
    predicates,
    dimension: dimensionName
      ? {
          expression: fieldExpression(dimensionName),
          ...(chartType === "histogram"
            ? { bin: { count: selection.dimension?.parameters.bins ?? 20 } }
            : {}),
          ...((chartType === "line" || chartType === "area") &&
          (selection.dimension?.id === "event.timestamp" ||
            selection.dimension?.parameters.timeUnit)
            ? {
                timeUnit:
                  selection.dimension?.parameters.timeUnit ?? ("day" as const),
              }
            : {}),
        }
      : undefined,
    series: seriesName
      ? { expression: fieldExpression(seriesName) }
      : undefined,
    measure: { operation: "count" },
    limit: chartType === "histogram" ? 500 : 100,
    order:
      chartType === "line" || chartType === "area" || chartType === "histogram"
        ? "dimension_asc"
        : "measure_desc",
  };
}
