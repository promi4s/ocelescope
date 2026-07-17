# Exploration Architecture

## Goal

The exploration module lets users answer OCEL questions without requiring a
new API endpoint or React component for every plot. The issue backlog defines
important ready-made analyses, but does not define the boundary of the system.

The architecture has three independent layers:

1. An OCEL query language describes the information to calculate.
2. A chart definition describes the shape of data it can render.
3. A preset binds a useful OCEL query to a chart and exposes a small parameter
   form.

## Query Language

The frontend should build a typed JSON AST. A textual PQL-like syntax can be
added later, but is not required for the editor or backend execution.

```ts
interface AnalysisQuery {
  source: "events" | "objects" | "e2o" | "o2o" | "object_changes";
  predicates: PredicateExpression[];
  dimension?: DimensionExpression;
  series?: DimensionExpression;
  measure: MeasureExpression;
  order: OrderExpression;
  limit: number;
}
```

Expressions are registered in a catalog with their parameter schema, result
type, and valid scopes. Initial field-level expressions include event activity,
event timestamp, event/object attributes, object type, relation qualifier,
count, distinct count, sum, average, minimum, maximum, and median.

OCEL-specific expressions required by the backlog include:

- involved object count per event and object type;
- object-type set per event;
- activity execution rank per object;
- time between selected activities for the same object;
- object attribute value at an event timestamp;
- object attribute change history;
- unique event-object relation count.

Expressions may internally use joins, window operations, as-of joins, or
multi-stage aggregation. These operations belong to the querying engine, not
to chart components.

## Chart Definitions

A chart declares data slots and constraints. It does not know OCEL semantics.

```ts
interface ChartDefinition {
  type: string;
  slots: {
    dimension?: SlotConstraint;
    measure: SlotConstraint;
    series?: SlotConstraint;
  };
  render: (data: AnalysisResult) => EChartsOption;
}
```

Examples:

- KPI: one measure, no dimension.
- Histogram: one numeric dimension and frequency measure.
- Bar: one categorical dimension, one measure, optional series.
- Line/area: one ordered or temporal dimension, one measure, optional series.
- Pie/sunburst: hierarchical categorical dimensions and one measure.

Adding a new rendering type should require a chart definition and renderer,
without adding OCEL query logic.

## Presets

Presets are reserved for analyses that require a genuinely specialized OCEL
expression or pipeline. Event attribute distribution is not a preset: users
configure it directly through event activity scope, attribute dimension, count
measure, and chart type.

The backlog plots become presets over reusable expressions. For example:

- Object type combination per event uses object-type set per event as the
  dimension, event count as the measure, and activity as the series.
- Activity execution count uses activity as the dimension, relation count as
  the measure, and activity execution rank as the series.
- Time between activities uses the time-between expression as its numeric
  dimension and a histogram as its chart.

Users can start from a preset and change compatible slots, or start with an
empty chart and select expressions directly.

## Delivery Order

1. Field-level dimensions and aggregate measures, backed by the current query
   endpoint.
2. Relation cardinality and event object-type-set expressions. This unlocks
   the sunburst, object-type combinations, and involvement distributions.
3. Window and paired-event expressions. This unlocks execution-frequency and
   time-between-activities plots.
4. Object-state and change-history expressions using as-of semantics. This
   unlocks object attribute distributions and development charts.

Each increment adds expressions and presets while keeping the chart and editor
contracts stable.
