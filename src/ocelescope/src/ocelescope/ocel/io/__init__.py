"""Convert OCEL 2.0 logs to/from a flat DuckDB representation.

**Reading.** :func:`convert_ocel_duckdb` picks the format from the file extension.
:func:`~ocelescope.ocel.io.r4pm.import_ocel_r4pm_streamed` reads the log into the
five flat OCEL tables (objects, object_changes, o2o, events, e2o); then the format's
extras reader (:mod:`ocelescope.ocel.io.extras`) copies every further table of the
log in under its own name. The quantity tables (quantities, quantity_operations,
quantity_item_properties) are such tables; a log with a deprecated quantity
extension (``quantityExtension``, ``<quantity-extension>`` or the SQLite
``operation``/``quantity``/``itemProperties`` tables) is read into them with a
:class:`DeprecationWarning`.

**Writing.** :func:`export_duckdb_ocel` is the inverse:
:func:`~ocelescope.ocel.io.r4pm.export_ocel_r4pm_streamed` writes the five flat
tables, and every other non-empty table is added as an extra with its table and
column names.

Both directions keep peak memory bounded rather than holding the whole log.

This package only deals with OCEL *files*. Reading and writing the DuckDB database
itself is the OCEL's own business, since a database is what an OCEL already is --
see :meth:`ocelescope.OCEL.read_duckdb` and :meth:`ocelescope.OCEL.to_duckdb`.
"""

from pathlib import Path

from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.extras.json import export_extras_json, import_extras_json
from ocelescope.ocel.io.extras.sqlite import export_extras_sqlite, import_extras_sqlite
from ocelescope.ocel.io.extras.tables import tables_to_export
from ocelescope.ocel.io.extras.xml import export_extras_xml, import_extras_xml
from ocelescope.ocel.io.r4pm import export_ocel_r4pm_streamed, import_ocel_r4pm_streamed
from ocelescope.ocel.io.schema import ensure_quantity_tables


def export_duckdb_ocel(source: DuckDBTarget, target: str | Path):
    export_ocel_r4pm_streamed(source, target)
    with connect_target(source) as con:
        tables = tables_to_export(con)
        match Path(target).suffix:
            case ".sqlite":
                export_extras_sqlite(con, target, tables)
            case ".json" | ".jsonocel":
                export_extras_json(con, target, tables)
            case ".xml" | ".xmlocel":
                export_extras_xml(con, target, tables)


def convert_ocel_duckdb(source: str | Path, target: DuckDBTarget):
    import_ocel_r4pm_streamed(source, target)
    match Path(source).suffix:
        case ".sqlite":
            import_extras_sqlite(source, target)
        case ".json" | ".jsonocel":
            import_extras_json(source, target)
        case ".xml" | ".xmlocel":
            import_extras_xml(source, target)
    # after the extras, so a log's own quantity tables are not in their way; the
    # database then holds all eight tables, and can be opened read-only as an OCEL
    with connect_target(target) as con:
        ensure_quantity_tables(con)


__all__ = [
    "DuckDBTarget",
    "connect_target",
    "convert_ocel_duckdb",
    "export_duckdb_ocel",
    "export_ocel_r4pm_streamed",
    "import_ocel_r4pm_streamed",
]
