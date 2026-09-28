"""Which tables of an OCEL's DuckDB are extras, for the exporters of every format."""

from __future__ import annotations

import duckdb

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
