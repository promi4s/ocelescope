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

from pathlib import Path

from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.exporters import (
    export_ocel_json,
    export_ocel_sqlite,
    export_ocel_xml,
)
from ocelescope.ocel.io.r4pm import import_ocel_r4pm_streamed


def convert_ocel_duckdb(source: str | Path, target: DuckDBTarget) -> None:
    """Read an OCEL file into a DuckDB database, dispatching on the file extension.

    Args:
        source: Path to an ``.jsonocel`` / ``.xmlocel`` / ``.sqlite`` OCEL 2.0 log.
        target: Path of the DuckDB database to (re)create, or an open connection
            to write into (which the caller keeps owning).
    """
    import_ocel_r4pm_streamed(source=source, target=target)


def export_duckdb_ocel(source: DuckDBTarget, target: str | Path) -> None:
    """Write a DuckDB OCEL database to a file, dispatching on the target extension.

    Args:
        source: Path to a DuckDB database produced by :func:`convert_ocel_duckdb`,
            or an open connection to one (e.g. an :class:`ocelescope.OCEL`'s own,
            which is what :meth:`ocelescope.OCEL.write` passes).
        target: Output path with a ``.jsonocel`` / ``.xmlocel`` / ``.sqlite`` extension.
    """
    match Path(target).suffix:
        case ".xmlocel" | ".xml":
            export_ocel_xml(source, target)
        case ".jsonocel" | ".json":
            export_ocel_json(source, target)
        case ".sqlite":
            export_ocel_sqlite(source, target)
        case suffix:
            raise ValueError(f"Unsupported extension: {suffix}")


__all__ = [
    "DuckDBTarget",
    "connect_target",
    "convert_ocel_duckdb",
    "export_duckdb_ocel",
    "export_ocel_json",
    "export_ocel_sqlite",
    "export_ocel_xml",
]
