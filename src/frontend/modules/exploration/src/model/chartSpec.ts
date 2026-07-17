import type { QueryFilterSchema } from "@ocelescope/api-querying";

import type { AnalysisQuery } from "./analysisQuery";
import type { SemanticChartSelection } from "./semanticCatalog";

export const CHART_SPEC_VERSION = 4 as const;

export const CHART_TYPES = [
  "kpi",
  "bar",
  "line",
  "area",
  "pie",
  "histogram",
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export interface ChartConfiguration {
  type: ChartType;
  showLegend: boolean;
}

export interface ChartInteraction {
  drilldown: boolean;
}

export interface ChartLayout {
  width: "half" | "full";
  height: "standard" | "large";
}

export interface ChartSpec {
  version: typeof CHART_SPEC_VERSION;
  id: string;
  title: string;
  chart: ChartConfiguration;
  selection: SemanticChartSelection;
  query: AnalysisQuery;
  interaction: ChartInteraction;
  layout: ChartLayout;
}

export interface ChartSelection {
  label: string;
  filters: QueryFilterSchema[];
}

export function createChartId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isChartSpec(value: unknown): value is ChartSpec {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChartSpec>;
  return (
    candidate.version === CHART_SPEC_VERSION &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    !!candidate.chart &&
    CHART_TYPES.includes(candidate.chart.type) &&
    !!candidate.selection &&
    !!candidate.query &&
    !!candidate.interaction &&
    !!candidate.layout
  );
}
