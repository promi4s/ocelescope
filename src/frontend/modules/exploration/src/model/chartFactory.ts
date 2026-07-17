import type { OcelSchemaResponse } from "@ocelescope/api-querying";
import { getChartDefinition } from "./chartRegistry";
import type { ChartSpec, ChartType } from "./chartSpec";
import { CHART_SPEC_VERSION, createChartId } from "./chartSpec";
import {
  buildSemanticQuery,
  defaultSemanticSelection,
} from "./semanticCatalog";

export function createCustomChartSpec(
  schema: OcelSchemaResponse,
  type: ChartType = "bar",
): ChartSpec {
  const definition = getChartDefinition(type);
  const selection = defaultSemanticSelection(schema, type);

  return {
    version: CHART_SPEC_VERSION,
    id: createChartId(),
    title: definition.label,
    chart: { type, showLegend: type === "pie" },
    selection,
    query: buildSemanticQuery(schema, type, selection),
    interaction: { drilldown: type !== "kpi" },
    layout: {
      width: type === "kpi" ? "half" : "full",
      height: "standard",
    },
  };
}
