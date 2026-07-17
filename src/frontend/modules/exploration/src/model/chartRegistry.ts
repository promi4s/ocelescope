import type {
  OcelFieldSchema,
  OcelSchemaResponse,
} from "@ocelescope/api-querying";
import type { MeasureOperation, OcelSource } from "./analysisQuery";
import {
  getExpressionField,
  getSourceSchema,
  validateAnalysisQuery,
} from "./analysisQuery";
import type { ChartSpec, ChartType } from "./chartSpec";

type FieldConstraint = "any" | Array<OcelFieldSchema["type"]>;

export interface ChartDefinition {
  type: ChartType;
  label: string;
  dimension: {
    required: boolean;
    types: FieldConstraint;
  };
  measure: {
    operations: MeasureOperation[];
  };
  allowsSeries: boolean;
  defaultOrder: ChartSpec["query"]["order"];
}

const AGGREGATES: MeasureOperation[] = [
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
  "median",
];

export const CHART_DEFINITIONS: ChartDefinition[] = [
  {
    type: "kpi",
    label: "KPI",
    dimension: { required: false, types: "any" },
    measure: { operations: AGGREGATES },
    allowsSeries: false,
    defaultOrder: "measure_desc",
  },
  {
    type: "bar",
    label: "Bar chart",
    dimension: { required: true, types: "any" },
    measure: { operations: AGGREGATES },
    allowsSeries: true,
    defaultOrder: "measure_desc",
  },
  {
    type: "line",
    label: "Line chart",
    dimension: { required: true, types: ["datetime", "number", "string"] },
    measure: { operations: AGGREGATES },
    allowsSeries: true,
    defaultOrder: "dimension_asc",
  },
  {
    type: "area",
    label: "Area chart",
    dimension: { required: true, types: ["datetime", "number", "string"] },
    measure: { operations: AGGREGATES },
    allowsSeries: true,
    defaultOrder: "dimension_asc",
  },
  {
    type: "pie",
    label: "Donut chart",
    dimension: { required: true, types: ["string", "boolean"] },
    measure: { operations: AGGREGATES },
    allowsSeries: false,
    defaultOrder: "measure_desc",
  },
  {
    type: "histogram",
    label: "Histogram",
    dimension: { required: true, types: ["number"] },
    measure: { operations: ["count"] },
    allowsSeries: false,
    defaultOrder: "dimension_asc",
  },
];

export function getChartDefinition(type: ChartType): ChartDefinition {
  const definition = CHART_DEFINITIONS.find((item) => item.type === type);
  if (!definition) throw new Error(`Unknown chart type '${type}'`);
  return definition;
}

export function fieldMatchesConstraint(
  field: OcelFieldSchema,
  constraint: FieldConstraint,
): boolean {
  return constraint === "any"
    ? field.type !== "unknown"
    : constraint.includes(field.type);
}

export function getDimensionFields(
  schema: OcelSchemaResponse,
  source: OcelSource,
  chartType: ChartType,
): OcelFieldSchema[] {
  const definition = getChartDefinition(chartType);
  return (
    getSourceSchema(schema, source)?.fields.filter(
      (field) =>
        field.role !== "technical" &&
        field.role !== "id" &&
        fieldMatchesConstraint(field, definition.dimension.types),
    ) ?? []
  );
}

export function getSeriesFields(
  schema: OcelSchemaResponse,
  source: OcelSource,
): OcelFieldSchema[] {
  return (
    getSourceSchema(schema, source)?.fields.filter(
      (field) =>
        field.role !== "technical" &&
        field.role !== "id" &&
        (field.type === "string" || field.type === "boolean"),
    ) ?? []
  );
}

export function getMeasureFields(
  schema: OcelSchemaResponse,
  source: OcelSource,
  operation: MeasureOperation,
): OcelFieldSchema[] {
  return (
    getSourceSchema(schema, source)?.fields.filter((field) => {
      if (field.role === "technical") return false;
      if (operation === "count_distinct") return field.type !== "unknown";
      return field.type === "number";
    }) ?? []
  );
}

export function validateChartSpec(
  spec: ChartSpec,
  schema: OcelSchemaResponse,
): string[] {
  const errors = validateAnalysisQuery(spec.query, schema);
  const definition = getChartDefinition(spec.chart.type);
  const dimensionField = getExpressionField(
    schema,
    spec.query.source,
    spec.query.dimension?.expression,
  );

  if (definition.dimension.required && !dimensionField) {
    errors.push("This chart requires a dimension");
  }
  if (
    !definition.dimension.required &&
    spec.chart.type === "kpi" &&
    spec.query.dimension
  ) {
    errors.push("KPI charts cannot have a dimension");
  }
  if (
    dimensionField &&
    !fieldMatchesConstraint(dimensionField, definition.dimension.types)
  ) {
    errors.push(`${dimensionField.name} is not valid for this chart type`);
  }
  if (!definition.measure.operations.includes(spec.query.measure.operation)) {
    errors.push(
      `${spec.query.measure.operation} is not valid for this chart type`,
    );
  }
  if (spec.query.series && !definition.allowsSeries) {
    errors.push("This chart type does not support a series");
  }
  if (spec.query.dimension?.bin && spec.chart.type !== "histogram") {
    errors.push("Binning is only supported by histograms");
  }
  return errors;
}

export function getChartInfo(spec: ChartSpec): string {
  const dimension = spec.query.dimension?.expression.field;
  const series = spec.query.series?.expression.field;
  const operation = spec.query.measure.operation;
  const measure =
    operation === "count"
      ? "row count"
      : `${operation} of '${spec.query.measure.expression?.field ?? "the selected field"}'`;
  const predicates = spec.query.predicates.length
    ? ` where ${spec.query.predicates
        .map(
          (predicate) =>
            `${predicate.field} ${predicate.operator} ${Array.isArray(predicate.value) ? predicate.value.join(", ") : String(predicate.value)}`,
        )
        .join(" and ")}`
    : "";
  return dimension
    ? `Groups ${spec.query.source}${predicates} by '${dimension}'${series ? ` and splits each group by '${series}'` : ""}, then displays the ${measure}. Missing dimension values are reported separately.`
    : `Displays the ${measure} across all ${spec.query.source}.`;
}

export function getChartSubtitle(spec: ChartSpec): string {
  const dimension = spec.query.dimension?.expression.field;
  const scope = spec.query.predicates
    .filter((predicate) => predicate.operator === "eq")
    .map((predicate) => String(predicate.value))
    .join(", ");
  return dimension
    ? `${spec.query.source}${scope ? ` · ${scope}` : ""} · grouped by ${dimension}`
    : `${spec.query.source} · all rows`;
}
