# @ocelescope/exploration

A dashboard of analytical questions about the active OCEL. Each card runs one
DuckDB query through `OcelChart` and draws the answer; there is no exploration
backend, so an analysis is only ever one place in the code.

## Layout

| File | Contents |
| --- | --- |
| `analyses.ts` | Every analysis: its question, parameters, SQL and chart |
| `Dashboard.tsx` | The searchable analysis catalog and responsive card grid |
| `Card.tsx` | One card: information, configuration, chart and export frame |
| `Controls.tsx` | The parameter inputs, and the log facts they offer |
| `store.ts` | The cards a reader has added, kept per OCEL in the browser |

To add an analysis, add an entry to `analyses.ts`.

A reader first chooses the question from the catalog and is taken directly to
its configuration. Required log names start empty; optional multi-selections
mean “all” when empty. Settings that are not names from the log (a result limit,
a time unit) carry a useful built-in value. Every card explains both what it
shows and how its data was determined in the information popover.

Queries run against the filtered OCEL - the one the rest of the app shows - over
its stored tables (`events`, `objects`, `e2o`, `object_changes`). Numeric
attributes are binned by the shared `histogram` helper (Freedman-Diaconis, with
far outliers counted in a `<` and a `>` bar); everything else is counted by
value, with a long tail folded into one bar.

The page is Mantine, like every other page in the app; the charts inside it are
r4pm viewers. Colours come from the shared resolver, so an activity keeps the
colour the graph viewers give it, each card sits in a `ViewerExportFrame` of its
own, and the attribute timeline uses the shared multi-axis `LineChart`.
