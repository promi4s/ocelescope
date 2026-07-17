import type {
  OcelQueryBody,
  OcelQueryResponse,
  OcelQueryResponseRowsItem,
  OcelSchemaResponse,
  QueryFilterSchema,
} from "@ocelescope/api-querying";
import type {
  ChartPoint,
  EChartCardProps,
  HistogramData,
} from "@ocelescope/charts";
import { histogramOption } from "@ocelescope/charts";
import type { TimeUnit } from "./analysisQuery";
import { compileAnalysisQuery, getSourceSchema } from "./analysisQuery";
import type { ChartSelection, ChartSpec } from "./chartSpec";

export interface ChartRenderModel {
  option: EChartCardProps["option"];
  note: string;
  empty: boolean;
  selectionForPoint: (point: ChartPoint) => ChartSelection | null;
}

const scalar = (
  row: OcelQueryResponseRowsItem,
  key: string,
): string | number | boolean | null => row[key] ?? null;

const numeric = (
  row: OcelQueryResponseRowsItem,
  key: string,
): number | null => {
  const value = scalar(row, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export function formatChartValue(value: unknown): string {
  if (value == null) return "Missing";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000 || (absolute > 0 && absolute < 0.001)) {
      return value.toExponential(2);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
      value,
    );
  }
  if (typeof value === "boolean") return value ? "True" : "False";
  const date = new Date(String(value));
  if (String(value).includes("T") && Number.isFinite(date.getTime())) {
    return date.toISOString().replace("T", " ").slice(0, 19);
  }
  return String(value);
}

export function compileChartQuery(spec: ChartSpec): OcelQueryBody {
  return compileAnalysisQuery(spec.query);
}

function missingCount(result: OcelQueryResponse): number {
  return Math.max(0, result.stats.filtered_rows - result.stats.matched_rows);
}

function missingShare(result: OcelQueryResponse): string {
  const count = missingCount(result);
  return result.stats.filtered_rows
    ? `${((count / result.stats.filtered_rows) * 100).toFixed(1)}%`
    : "0.0%";
}

function resultNote(spec: ChartSpec, result: OcelQueryResponse): string {
  if (spec.query.dimension) {
    const missing = missingCount(result);
    return `${result.stats.matched_rows.toLocaleString("en-US")} values across ${result.stats.filtered_rows.toLocaleString("en-US")} source rows · ${missing.toLocaleString("en-US")} missing (${missingShare(result)})`;
  }
  return `${result.stats.filtered_rows.toLocaleString("en-US")} source rows`;
}

function histogramData(result: OcelQueryResponse): HistogramData | null {
  const bins = result.rows.flatMap((row, index) => {
    const start = numeric(row, "dimension_start");
    const end = numeric(row, "dimension_end");
    const count = numeric(row, "measure");
    if (start == null || end == null || count == null) return [];
    return [
      {
        start,
        end,
        count,
        inclusiveEnd: index === result.rows.length - 1,
      },
    ];
  });
  const first = bins[0];
  const last = bins.at(-1);
  if (!first || !last) return null;
  const domain = { min: first.start, max: last.end };
  return {
    bins,
    domain,
    covered: domain,
    counts: {
      covered: result.stats.matched_rows,
      missing: missingCount(result),
      total: result.stats.filtered_rows,
    },
  };
}

function addTimeUnit(value: string, unit: TimeUnit | undefined): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  if (unit === "minute") date.setUTCMinutes(date.getUTCMinutes() + 1);
  else if (unit === "hour") date.setUTCHours(date.getUTCHours() + 1);
  else if (unit === "week") date.setUTCDate(date.getUTCDate() + 7);
  else if (unit === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else if (unit === "quarter") date.setUTCMonth(date.getUTCMonth() + 3);
  else if (unit === "year") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function pointSelection(
  spec: ChartSpec,
  result: OcelQueryResponse,
  point: ChartPoint,
): ChartSelection | null {
  const dimensionField = spec.query.dimension?.expression.field;
  if (!dimensionField) return null;
  if (
    point.dataIndex >= result.rows.length &&
    !spec.query.series &&
    missingCount(result) > 0
  ) {
    return {
      label: "Missing values",
      filters: [{ field: dimensionField, operator: "is_null" }],
    };
  }

  const row = spec.query.series
    ? (() => {
        const categories = [
          ...new Set(
            result.rows.map((item) =>
              formatChartValue(scalar(item, "dimension")),
            ),
          ),
        ];
        const category = categories[point.dataIndex];
        return result.rows.find(
          (item) =>
            formatChartValue(scalar(item, "dimension")) === category &&
            formatChartValue(scalar(item, "series")) === point.seriesName,
        );
      })()
    : result.rows[point.dataIndex];
  const value = row ? scalar(row, "dimension") : null;
  if (value == null) return null;
  const filters: QueryFilterSchema[] = spec.query.dimension?.timeUnit
    ? [
        { field: dimensionField, operator: "gte" as const, value },
        {
          field: dimensionField,
          operator: "lt" as const,
          value: addTimeUnit(String(value), spec.query.dimension.timeUnit),
        },
      ]
    : [{ field: dimensionField, operator: "eq" as const, value }];
  const seriesField = spec.query.series?.expression.field;
  const seriesValue = row ? scalar(row, "series") : null;
  if (seriesField && seriesValue != null) {
    filters.push({ field: seriesField, operator: "eq", value: seriesValue });
  }
  return { label: formatChartValue(value), filters };
}

function categoricalOption(spec: ChartSpec, result: OcelQueryResponse) {
  const categories = [
    ...new Set(
      result.rows.map((row) => formatChartValue(scalar(row, "dimension"))),
    ),
  ];
  const hasSeries = Boolean(spec.query.series);
  const seriesNames = hasSeries
    ? [
        ...new Set(
          result.rows.map((row) => formatChartValue(scalar(row, "series"))),
        ),
      ]
    : ["Value"];
  const values = new Map(
    result.rows.map((row) => [
      `${formatChartValue(scalar(row, "dimension"))}\u0000${
        hasSeries ? formatChartValue(scalar(row, "series")) : "Value"
      }`,
      numeric(row, "measure") ?? 0,
    ]),
  );
  const missing = missingCount(result);
  if (
    !hasSeries &&
    missing > 0 &&
    spec.chart.type !== "line" &&
    spec.chart.type !== "area"
  ) {
    categories.push("Missing");
    values.set("Missing\u0000Value", missing);
  }

  const isLine = spec.chart.type === "line" || spec.chart.type === "area";
  return {
    categories,
    series: seriesNames.map((name) => ({
      name,
      type: isLine ? ("line" as const) : ("bar" as const),
      data: categories.map(
        (category) => values.get(`${category}\u0000${name}`) ?? 0,
      ),
      stack: hasSeries && spec.chart.type === "bar" ? "total" : undefined,
      smooth: isLine,
      areaStyle: spec.chart.type === "area" ? {} : undefined,
      showSymbol: categories.length < 80,
    })),
  };
}

export function buildChartRenderModel(
  spec: ChartSpec,
  result: OcelQueryResponse,
): ChartRenderModel {
  if (spec.chart.type === "kpi") {
    const value = result.rows[0] ? scalar(result.rows[0], "measure") : null;
    return {
      option: {
        graphic: [
          {
            type: "text",
            left: "center",
            top: "middle",
            style: {
              text: formatChartValue(value),
              fontSize: 44,
              fontWeight: 650,
              fill: "#1f2937",
            },
          },
        ],
      },
      note: resultNote(spec, result),
      empty: value == null,
      selectionForPoint: () => null,
    };
  }

  if (spec.chart.type === "histogram") {
    const data = histogramData(result);
    return {
      option: data ? histogramOption(data) : null,
      note: resultNote(spec, result),
      empty: data == null,
      selectionForPoint: (point) => {
        const row = result.rows[point.dataIndex];
        const field = spec.query.dimension?.expression.field;
        const start = row ? numeric(row, "dimension_start") : null;
        const end = row ? numeric(row, "dimension_end") : null;
        if (!field || start == null || end == null) return null;
        const last = point.dataIndex === result.rows.length - 1;
        return {
          label: `[${formatChartValue(start)}, ${formatChartValue(end)}${last ? "]" : ")"}`,
          filters: [
            { field, operator: "gte", value: start },
            { field, operator: last ? "lte" : "lt", value: end },
          ],
        };
      },
    };
  }

  if (spec.chart.type === "pie") {
    const missing = missingCount(result);
    const data = result.rows.map((row) => ({
      name: formatChartValue(scalar(row, "dimension")),
      value: numeric(row, "measure") ?? 0,
    }));
    if (missing > 0) data.push({ name: "Missing", value: missing });
    return {
      option: {
        tooltip: { trigger: "item", formatter: "{b}<br/>{c} ({d}%)" },
        legend: { show: spec.chart.showLegend, type: "scroll", bottom: 0 },
        series: [
          {
            type: "pie",
            radius: ["35%", "72%"],
            center: ["50%", spec.chart.showLegend ? "44%" : "50%"],
            label: { formatter: "{b}: {d}%" },
            data,
          },
        ],
      },
      note: resultNote(spec, result),
      empty: data.length === 0,
      selectionForPoint: (point) => pointSelection(spec, result, point),
    };
  }

  const categorical = categoricalOption(spec, result);
  return {
    option: {
      grid: { containLabel: true, left: 16, right: 16, top: 28, bottom: 16 },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type:
            spec.chart.type === "line" || spec.chart.type === "area"
              ? "line"
              : "shadow",
        },
      },
      legend: {
        show: Boolean(spec.query.series),
        type: "scroll",
        bottom: 0,
      },
      xAxis: {
        type: "category",
        data: categorical.categories,
        axisLabel: { hideOverlap: true, width: 120, overflow: "truncate" },
      },
      yAxis: { type: "value" },
      series: categorical.series,
    },
    note: resultNote(spec, result),
    empty: categorical.categories.length === 0,
    selectionForPoint: (point) => pointSelection(spec, result, point),
  };
}

export function drillDownQuery(
  spec: ChartSpec,
  schema: OcelSchemaResponse,
  selection: ChartSelection,
): OcelQueryBody {
  const source = getSourceSchema(schema, spec.query.source);
  const candidates = [
    source?.id_field,
    source?.timestamp_field,
    source?.type_field,
    spec.query.dimension?.expression.field,
    spec.query.series?.expression.field,
    spec.query.measure.expression?.field,
  ];
  const fields = [
    ...new Set(candidates.filter((field): field is string => Boolean(field))),
  ];
  const fallback = source?.fields[0]?.name;
  if (!fields.length && fallback) fields.push(fallback);
  return {
    source: spec.query.source,
    fields,
    filters: [...spec.query.predicates, ...selection.filters],
    order_by:
      source?.timestamp_field && fields.includes(source.timestamp_field)
        ? [{ field: source.timestamp_field, direction: "asc" }]
        : [],
    limit: 100,
  };
}
