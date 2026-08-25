from pathlib import Path

from duckdb import DuckDBPyConnection

from ocelescope.ocel.io.connection import DuckDBTarget
from ocelescope.ocel.io.quantities.json import export_quantities_json, import_quantities_json
from ocelescope.ocel.io.quantities.sqlite import export_quantities_sqlite, import_quantities_sqlite
from ocelescope.ocel.io.quantities.xml import export_quantities_xml, import_quantities_xml


def import_quantities(source: str | Path, target: DuckDBTarget) -> None:
    source = Path(source)

    match source.suffix:
        case ".json":
            import_quantities_json(source, target)
        case ".xml":
            import_quantities_xml(source, target)
        case ".sqlite":
            import_quantities_sqlite(source, target)


def export_quantities(
    source: DuckDBPyConnection,
    target: str | Path,
) -> None:
    target = Path(target)

    is_empty = source.sql("""
        SELECT
            oqty = 0
            or qip = 0
            or qop = 0 as is_empty
        FROM
        (
            SELECT
            (
                SELECT
                count(*)
                FROM
                quantities
            ) AS oqty,
            (
                SELECT
                count(*)
                FROM
                quantity_item_properties
            ) as qip,
            (
                SELECT
                count(*)
                FROM
                quantity_operations
            ) as qop
        )
    """).fetchone()

    if is_empty is None or is_empty[0]:
        return

    match target.suffix:
        case ".json":
            export_quantities_json(source, target)
        case ".xml":
            export_quantities_xml(source, target)
        case ".sqlite":
            export_quantities_sqlite(source, target)


__all__ = ["import_quantities", "export_quantities"]
