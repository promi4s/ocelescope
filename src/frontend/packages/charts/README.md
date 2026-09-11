# Ocelescope charts

The public API consists of `Chart`, `ChartCard`, `useChartDrilldown`, and
`useChartTheme`. Rendering, layout, tooltips, and data shaping are private.

```tsx
import { Chart, ChartCard } from "@ocelescope/charts";

<ChartCard title="Events per activity">
  <Chart type="bar" rows={rows} x="activity" y="count"
    series="objectType" stack orientation="horizontal"
    onSelect={selection => openDetails(selection.rows)} />
</ChartCard>;
```

`Chart` also works alone with an explicit height. The optional card supplies
controls, help, errors, fullscreen, reset, and PNG/SVG export.

## Chart types

`ChartProps` is a discriminated union: `type` determines the available settings.
A pie cannot accidentally accept axis settings or zoom. No type accepts engine
options, engine events, or an engine instance.

| Type | Data columns | Main settings |
| --- | --- | --- |
| `bar` | `x`, `y`, optional `series` | `stack`, `orientation`, `topN`, `flush` |
| `line` | `x`, `y`, optional `series` | `area`, `smooth`, `step`, `stack` |
| `scatter` | `x`, `y`, optional `series` | `symbolSize` |
| `pie` | `name`, `value` | `donut`, `topN`, `showLabels` |
| `sunburst` | `path` (columns from inner to outer ring), `value` | `labelDepth`, `minShare`, `nodeValue` |
| `timeline` | `x`, `values` (independent-scale columns) | `legend`, `tooltip={false}` |

Rows are observations containing primitive values. API response adaptation belongs
in the feature module. Timeline rows contain one value per series column; the
other charts use long rows and split series using a column's values.

Bars and pies sort descending by default. Lines and scatter retain input order.
`sort="none"` preserves order explicitly. Positive integer `topN` values fold
the tail into “Other”; invalid or non-positive values leave all rows visible.

Cartesian charts support `xAxis`, `yAxis`, `valueFormat`, and declarative tooltip
settings. Cartesian and timeline charts support `zoom`, controlled `viewport`,
`onViewportChange`, and `brush`/`onSelection`. Viewports use 0–100 percentages;
brush selections use axis coordinates (indices on a categorical axis).

Colours follow Mantine. Use `palette` for custom series colours and `itemColor`
on bars or pies for individual marks. `useChartTheme` exposes resolved colours
for semantic distinctions such as missing values.

## Drill-down

`onSelect` always reports original observations:

- `rows`: every observation contributing to the mark, including grouped and
  folded marks. Use these when filtering locally.
- `row`: the first contributing observation, convenient for individual marks.
- `category`, optional `series`, and `value`: the selected mark's data.
- `path`: the full hierarchy path for sunburst marks, distinguishing repeated
  labels under different parents.

```tsx
import { Chart, type Row, useChartDrilldown } from "@ocelescope/charts";

function Breakdown({ rows }: { rows: Row[] }) {
  const drill = useChartDrilldown();
  return <>
    <button onClick={drill.back} disabled={!drill.canGoBack}>Back</button>
    <Chart key={drill.path.length} type="bar" height={320}
      rows={drill.current?.rows ?? rows}
      x={drill.canGoBack ? "objectType" : "activity"} y="count"
      series={drill.canGoBack ? undefined : "objectType"}
      onSelect={drill.canGoBack ? undefined : drill.onSelect} />
  </>;
}
```

The hook owns navigation (`path`, `current`, `back`, `reset`); the consumer decides
the next dimension and whether to filter or fetch. Reset navigation when changing
datasets. No OCEL queries or exploration concepts live in the package.

## Implementation

- `types.ts` defines the public contract in one place.
- `Chart.tsx` selects a builder and renders its output. No component factory,
  plugin registry, or alternate-renderer framework is needed.
- `ChartCard.tsx` communicates through export/reset capabilities, without holding
  a renderer instance.
- `internal/` contains the rendering engine, axis interactions, theme, tooltips,
  small data helpers, and four builders (Cartesian, pie, sunburst, timeline).

To add a chart type, add its contract, builder, and a case in `Chart`. Keep engine
settings inside `internal/`. The current engine is an implementation dependency;
replacing it must preserve the public contract and selection semantics.
