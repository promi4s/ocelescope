"""Table helpers the extras modules of every format share."""

from __future__ import annotations

from typing import Any

import duckdb
import pyarrow as pa

from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.util.sql import ident

FLAT_TABLES = {OBJECTS_TABLE, OBJECT_CHANGES_TABLE, O2O_TABLE, EVENTS_TABLE, E2O_TABLE}
"""Written by the OCEL exporter itself, never as an extra."""


def tables_to_export(con: duckdb.DuckDBPyConnection) -> list[str]:
    """The tables to write as extras: every non-empty one but the five flat tables, sorted.

    Empty tables are left out, so a log without quantities does not grow empty
    quantity lists on the way out.
    """
    tables = [
        name
        for (name,) in con.execute("""
            SELECT table_name FROM duckdb_tables()
            WHERE database_name = current_database() AND schema_name = current_schema()
            ORDER BY table_name
        """).fetchall()
        if name not in FLAT_TABLES
    ]
    return [
        table
        for table in tables
        if con.execute(f"SELECT 1 FROM {ident(table)} LIMIT 1").fetchone() is not None
    ]


def column_types(con: duckdb.DuckDBPyConnection, table: str) -> list[tuple[str, str]]:
    """``(column, DuckDB type)`` of ``table``, in table order."""
    return [
        (name, column_type)
        for name, column_type, *_ in con.execute(f"DESCRIBE {ident(table)}").fetchall()
    ]


def rows_to_arrow(rows: list[dict[str, Any]], table: str) -> pa.Table:
    """The rows as an Arrow table, with a column for every key of every row.

    Unlike ``pa.Table.from_pylist``, which takes the columns from the first row
    only, a key missing from some rows is NULL there -- the XML exporter leaves a
    NULL attribute out. A key whose values have different kinds (``1`` and
    ``"x"``) is not something the exporters write, so it raises.
    """
    keys = dict.fromkeys(key for row in rows for key in row)
    columns = {}
    for key in keys:
        try:
            columns[key] = pa.array([row.get(key) for row in rows])
        except (pa.ArrowInvalid, pa.ArrowTypeError) as error:
            raise ValueError(
                f"column {key!r} of extra table {table!r} mixes values of different types"
            ) from error
    return pa.table(columns)
