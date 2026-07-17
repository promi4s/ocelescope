import { defineModule } from "@ocelescope/core";
import { ChartNoAxesCombinedIcon } from "lucide-react";

import exploration from "./pages/exploration";

export type {
  AnalysisQuery,
  FieldExpression,
  QueryDimension,
  QueryMeasure,
} from "./model/analysisQuery";
export type { ChartDefinition } from "./model/chartRegistry";
export { CHART_DEFINITIONS } from "./model/chartRegistry";
export { buildChartRenderModel, compileChartQuery } from "./model/chartRuntime";
export type { ChartSpec, ChartType } from "./model/chartSpec";
export type {
  DimensionExpressionId,
  MeasureExpressionId,
  SemanticChartSelection,
} from "./model/semanticCatalog";
export {
  buildSemanticQuery,
  DIMENSION_EXPRESSIONS,
  MEASURE_EXPRESSIONS,
} from "./model/semanticCatalog";

export default defineModule({
  name: "exploration",
  description: "Interactive charts for exploring object-centric event logs",
  label: "Exploration",
  authors: [{ name: "Ocelescope contributors" }],
  routes: [exploration],
  icon: ChartNoAxesCombinedIcon,
});
