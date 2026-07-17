# @ocelescope/charts

Shared chart layout and interaction primitives for Ocelescope. The package is
data-source agnostic; consumers provide ECharts options and keep domain queries
in their own module.

## EChartCard

`EChartCard` provides the standard title area, controls, settings, actions,
loading/error/empty states, PNG export, expanded view, zoom, brushing, point
clicks, and an escape hatch for chart-specific ECharts events.

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
the same layout. `histogramOption` is available as a data-to-option helper for
declarative chart systems.
