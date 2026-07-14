# ocelescope-module-ocel

Ocelescope backend module exposing the OCEL inspection API (metadata, attributes,
object/event summaries, relation counts, variants, quantities and export).

Routes read the OCEL through the RAM-efficient `OCELDb` handle (`ApiOCELDb`) and
compute their results with lazy polars over the DuckDB store, so the whole log is
never materialized into pandas -- except the XES flat-log exports, which need the
pm4py OCEL.

Mounted at `/modules/ocel/v1`.
