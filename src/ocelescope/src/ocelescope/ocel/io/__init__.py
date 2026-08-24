"""Convert OCEL 2.0 logs to/from a flat DuckDB representation.

**Reading.** ``import_ocel_json`` / ``import_ocel_xml`` / ``import_ocel_sqlite``
read a log incrementally and write the five flat OCEL tables (objects,
object_changes, o2o, events, e2o) into a single DuckDB file via the shared
:class:`OCELWriter`. If the log carries a quantity extension, three further tables
(quantities, quantity_operations, quantity_item_properties) are added alongside.

**Writing.** ``export_ocel_json`` / ``export_ocel_xml`` / ``export_ocel_sqlite``
are the inverse: they stream those DuckDB tables back out into an OCEL 2.0 log.

Both directions keep peak memory bounded by a single entity rather than the whole
log. ``convert_ocel_duckdb`` and ``export_duckdb_ocel`` are the format-dispatching
entry points -- pick the reader/writer from the file extension.

This package only deals with OCEL *files*. Reading and writing the DuckDB database
itself is the OCEL's own business, since a database is what an OCEL already is --
see :meth:`ocelescope.OCEL.read_duckdb` and :meth:`ocelescope.OCEL.to_duckdb`.
"""

from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.quantities import export_quantities, import_quantities
from ocelescope.ocel.io.r4pm import export_ocel_r4pm_streamed, import_ocel_r4pm_streamed

__all__ = [
    "DuckDBTarget",
    "connect_target",
    "export_ocel_r4pm_streamed",
    "import_ocel_r4pm_streamed",
    "import_quantities",
    "export_quantities",
]
