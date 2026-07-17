# @ocelescope/exploration

Interactive, query-driven OCEL dashboards for Ocelescope.

Every visualization consists of two independent parts:

- an `AnalysisQuery` describing source, predicates, dimension, optional series,
  and measure;
- a chart definition describing which query slots it accepts and how results
  are rendered.

Event attribute distributions are configured directly by selecting the event
source, an optional activity scope, an attribute dimension, row count, and a
compatible chart type.

```ts
const chart: ChartSpec = {
  version: 3,
  id: crypto.randomUUID(),
  title: "Average cost by activity",
  chart: { type: "bar", showLegend: false },
  query: {
    source: "events",
    predicates: [],
    dimension: {
      expression: { kind: "field", field: "ocel:activity" },
    },
    measure: {
      operation: "avg",
      expression: { kind: "field", field: "cost" },
    },
    limit: 100,
    order: "measure_desc",
  },
  interaction: { drilldown: true },
  layout: { width: "full", height: "standard" },
};
```

`analysisQuery.ts` owns the query AST and compilation to the current querying
endpoint. `chartRegistry.ts` owns chart slot constraints. `chartFactory.ts`
contains starter configurations. `chartRuntime.ts` maps stable query result
aliases to ECharts.

The dashboard starts empty. Users configure KPI, bar, line, area, donut, and
histogram charts directly.
