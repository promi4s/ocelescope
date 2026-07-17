import type {
  OcelFieldSchema,
  OcelQueryBody,
  OcelSchemaResponse,
  QueryFilterSchema,
  QueryMeasureSchema,
} from "@ocelescope/api-querying";

export type OcelSource = OcelQueryBody["source"];
export type MeasureOperation = QueryMeasureSchema["operation"];
export type TimeUnit = NonNullable<
  NonNullable<OcelQueryBody["group_by"]>[number]["time_unit"]
>;

export interface FieldExpression {
  kind: "field";
  field: string;
}

export interface QueryDimension {
  expression: FieldExpression;
  bin?: { count: number };
  timeUnit?: TimeUnit;
}

export interface QueryMeasure {
  operation: MeasureOperation;
  expression?: FieldExpression;
}

export interface AnalysisQuery {
  source: OcelSource;
  predicates: QueryFilterSchema[];
  dimension?: QueryDimension;
  series?: QueryDimension;
  measure: QueryMeasure;
  limit: number;
  order: "dimension_asc" | "measure_asc" | "measure_desc";
}

export const fieldExpression = (field: string): FieldExpression => ({
  kind: "field",
  field,
});

export function getSourceSchema(
  schema: OcelSchemaResponse,
  source: OcelSource,
) {
  return schema.sources.find((candidate) => candidate.name === source);
}

export function getExpressionField(
  schema: OcelSchemaResponse,
  source: OcelSource,
  expression: FieldExpression | undefined,
): OcelFieldSchema | undefined {
  return getSourceSchema(schema, source)?.fields.find(
    (field) => field.name === expression?.field,
  );
}

export function compileAnalysisQuery(query: AnalysisQuery): OcelQueryBody {
  const groupBy: NonNullable<OcelQueryBody["group_by"]> = [];
  if (query.dimension) {
    groupBy.push({
      field: query.dimension.expression.field,
      alias: "dimension",
      ...(query.dimension.bin ? { bin: query.dimension.bin } : {}),
      ...(query.dimension.timeUnit
        ? { time_unit: query.dimension.timeUnit }
        : {}),
    });
  }
  if (query.series) {
    groupBy.push({
      field: query.series.expression.field,
      alias: "series",
      ...(query.series.timeUnit ? { time_unit: query.series.timeUnit } : {}),
    });
  }

  const measure: NonNullable<OcelQueryBody["measures"]>[number] = {
    operation: query.measure.operation,
    alias: "measure",
    ...(query.measure.operation === "count"
      ? {}
      : { field: query.measure.expression?.field }),
  };
  const binned = Boolean(query.dimension?.bin);
  const orderField =
    query.order === "dimension_asc"
      ? binned
        ? "dimension_start"
        : "dimension"
      : "measure";

  return {
    source: query.source,
    filters: query.predicates,
    group_by: groupBy,
    measures: [measure],
    order_by: [
      {
        field: orderField,
        direction: query.order === "measure_desc" ? "desc" : "asc",
      },
    ],
    limit: query.limit,
  };
}

export function validateAnalysisQuery(
  query: AnalysisQuery,
  schema: OcelSchemaResponse,
): string[] {
  const source = getSourceSchema(schema, query.source);
  if (!source) return [`Source '${query.source}' is not available`];
  const errors: string[] = [];
  const fields = new Map(source.fields.map((field) => [field.name, field]));

  for (const [label, dimension] of [
    ["Dimension", query.dimension],
    ["Series", query.series],
  ] as const) {
    if (dimension && !fields.has(dimension.expression.field)) {
      errors.push(
        `${label} field '${dimension.expression.field}' is unavailable`,
      );
    }
    if (
      dimension?.bin &&
      (dimension.bin.count < 1 || dimension.bin.count > 500)
    ) {
      errors.push("Bins must be between 1 and 500");
    }
  }

  if (query.measure.operation !== "count") {
    const measureField = query.measure.expression
      ? fields.get(query.measure.expression.field)
      : undefined;
    if (!measureField) errors.push("Measure field is required");
    else if (
      query.measure.operation !== "count_distinct" &&
      measureField.type !== "number"
    ) {
      errors.push(`${query.measure.operation} requires a numeric field`);
    }
  }
  for (const predicate of query.predicates) {
    if (!fields.has(predicate.field)) {
      errors.push(`Predicate field '${predicate.field}' is unavailable`);
    }
  }
  if (query.limit < 1 || query.limit > 5000) {
    errors.push("Maximum results must be between 1 and 5000");
  }
  return errors;
}
