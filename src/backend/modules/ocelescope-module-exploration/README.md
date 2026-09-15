# ocelescope-module-exploration

Backend for the Exploration dashboard: ten analytical queries over the active
OCEL. Mounted at `/modules/exploration/v1`.

## Contract

One endpoint runs every analysis. The body's `analysis` field selects it:

```http
POST /ocels/{ocel_id}/queries?ocel_version=filtered
{"analysis": "activity-execution-frequency", "object_type": "Container"}
```

Every analysis answers with `{"rows": [...], "meta": {...}}`: tidy rows, plus
the population figures that belong to them under explicit names (`pair_count`,
`total_event_count`, ...). A query that does not fit the log is a `400`.

Parameters are validated against the original log, the one the editors offer
choices from; results are computed from the filtered log. A filter can empty a
chart but never invalidate it.

## Layout

| File | Contents |
| --- | --- |
| `module.py` | The app, the endpoint, opening the original log |
| `log.py` | `Log(filtered, original)`: running SQL, validating names, `Result` |
| `buckets.py` | Grouping one column of values into distribution buckets |
| `analyses/frequencies.py` | Execution frequency and distribution, total involvement, type combinations, counts per event |
| `analyses/distributions.py` | Event and object attribute distributions, object involvement, time between activities |
| `analyses/timeline.py` | An object's attribute timeline |
| `analyses/__init__.py` | The `Query` union |

Each analysis is a Pydantic model: its parameters, and a `run(log)` method that
is DuckDB SQL over the log's `events`, `e2o`, `objects` and `object_changes`
tables. The `BASE` CTEs in `log.py` provide `ev` (events) and `rel` (each
event-object relation with activity, timestamp and object type).

To add an analysis, write the model in the matching file and add it to `Query`.

The [compatibility baseline](../../../../docs/exploration/compatibility.md)
records what each analysis means.
