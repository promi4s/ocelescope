# ocelescope-module-ocel

Ocelescope backend module exposing the OCEL inspection API (metadata, attributes,
object/event summaries, relation counts, variants, quantities and export). It
also provides `POST /{ocel_id}/query` for reusable frontend components that run
DuckDB SQL directly against the original or filtered OCEL.

Mounted at `/modules/ocel/v1`.
