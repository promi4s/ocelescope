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
"""

from pathlib import Path

from ocelescope.ocel.io.export_json import export_ocel_json
from ocelescope.ocel.io.export_sqlite import export_ocel_sqlite
from ocelescope.ocel.io.export_xml import export_ocel_xml
from ocelescope.ocel.io.json import import_ocel_json
from ocelescope.ocel.io.read_duckdb import dump_ocel_duckdb, load_ocel_duckdb
from ocelescope.ocel.io.sqlite import import_ocel_sqlite
from ocelescope.ocel.io.writer import OCELWriter
from ocelescope.ocel.io.xml import import_ocel_xml


def convert_ocel_duckdb(source: str | Path, db_path: str | Path) -> None:
    """Read an OCEL file into a DuckDB database, dispatching on the file extension.

    Args:
        source: Path to an ``.jsonocel`` / ``.xmlocel`` / ``.sqlite`` OCEL 2.0 log.
        db_path: Path of the DuckDB database to (re)create.
    """
    match Path(source).suffix:
        case ".xmlocel" | ".xml":
            import_ocel_xml(source, db_path)
        case ".jsonocel" | ".json":
            import_ocel_json(source, db_path)
        case ".sqlite":
            import_ocel_sqlite(source, db_path)
        case suffix:
            raise ValueError(f"Unsupported extension: {suffix}")


def export_duckdb_ocel(db_path: str | Path, target: str | Path) -> None:
    """Write a DuckDB OCEL database to a file, dispatching on the target extension.

    Args:
        db_path: Path to a DuckDB database produced by :func:`convert_ocel_duckdb`.
        target: Output path with a ``.jsonocel`` / ``.xmlocel`` / ``.sqlite`` extension.
    """
    match Path(target).suffix:
        case ".xmlocel" | ".xml":
            export_ocel_xml(db_path, target)
        case ".jsonocel" | ".json":
            export_ocel_json(db_path, target)
        case ".sqlite":
            export_ocel_sqlite(db_path, target)
        case suffix:
            raise ValueError(f"Unsupported extension: {suffix}")


__all__ = [
    "OCELWriter",
    "convert_ocel_duckdb",
    "dump_ocel_duckdb",
    "export_duckdb_ocel",
    "export_ocel_json",
    "export_ocel_sqlite",
    "export_ocel_xml",
    "import_ocel_json",
    "import_ocel_sqlite",
    "import_ocel_xml",
    "load_ocel_duckdb",
]
