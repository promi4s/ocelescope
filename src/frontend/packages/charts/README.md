# @ocelescope/charts

Shared chart components and reusable ECharts configurations for Ocelescope.
The package is data-source agnostic: domain modules query and map their data,
while this package owns consistent rendering, interaction, and presentation.

## Structure

```text
src/
├── configurations/
│   ├── bar.ts
│   ├── donut.ts
│   ├── histogram.ts
│   ├── horizontalStackedBar.ts
│   ├── sunburst.ts
│   ├── stackedBar.ts
│   ├── shared.ts
│   ├── types.ts
│   └── index.ts
├── ChartCard.tsx
├── ChartCanvas.tsx
├── EChartCard.tsx
├── chartOption.ts
├── useChartExport.ts
├── useEChartInteractions.ts
└── useChartInteractions.ts
```

Established visual patterns belong in `configurations` and expose typed,
domain-neutral option builders. Domain modules convert their API responses to
the shared data contracts and select an appropriate builder. A specialized
chart may provide a custom `EChartsOption`, but OCEL querying and aggregation
never belong in this package.

```tsx
const option = createHistogramChartOption(
  {
    bins: buckets.map((bucket) => ({
      label: bucket.label,
      value: bucket.count,
    })),
  },
  { seriesName: "Events" },
);
```

Backend-generated API types remain in their owning module and are never
imported into this package.

## EChartCard

`EChartCard` provides the standard title area, controls, settings, actions,
loading/error/empty states, PNG and SVG export, expanded view, zoom, brushing,
point clicks, and an escape hatch for chart-specific ECharts events.

Zoom can be uncontrolled by passing only `zoom`, or controlled by also passing
`viewport` and `onViewportChange`. Controlled interactions allow multiple
charts to coordinate their visible ranges.

```tsx
const interactions = useChartInteractions();

<EChartCard
  title="Events by activity"
  option={option}
  loading={query.isPending}
  error={query.error ? "Unable to load events." : undefined}
  empty={rows.length === 0}
  zoom={{ axis: "x" }}
  viewport={interactions.viewport}
  onViewportChange={interactions.onViewportChange}
  onPointClick={interactions.onPointClick}
/>
```

Use `ChartCard` directly when the content is not ECharts-based but should use
the same layout.
