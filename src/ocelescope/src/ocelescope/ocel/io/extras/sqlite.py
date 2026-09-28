"""Copy the non-OCEL tables of a SQLite OCEL log into DuckDB.

An OCEL 2.0 SQLite log is a fixed set of tables (``event``, ``object``,
``event_object``, ``object_object`` and the two ``*_map_type`` tables) plus one
attribute table per type, named ``event_<map>`` / ``object_<map>`` after the
``ocel_type_map`` column of the map tables. Every other table is an extra and is
copied as it is, under its own name. The legacy quantity extension tables are
copied the same way and then converted into the quantity tables by
:func:`~ocelescope.ocel.io.extras.quantities.sqlite.quantities_from_extras`.

The file is attached and each table copied by one ``CREATE TABLE ... AS SELECT``,
so nothing flows through Python. The declared column types are read through
``sqlite3``, because DuckDB has already flattened them (a ``BOOLEAN`` reads back
as ``BIGINT``) by the time the file is attached.

Writing is the reverse (:func:`export_extras_sqlite`): each table is created
through ``sqlite3`` with its types declared -- DuckDB would only ever declare
``VARCHAR``/``BIGINT``/``DOUBLE`` -- and then filled by DuckDB.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import duckdb

from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.extras.quantities.sqlite import (
    SQL_ITEM_PROPERTIES,
    SQL_OPERATIONS,
    SQL_QUANTITIES,
    quantities_from_extras,
)
from ocelescope.ocel.io.extras.tables import column_types
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_DUCKDB, duckdb_to_attribute_type
from ocelescope.util.sql import ident, literal

OCEL_TABLES = {
    "event",
    "object",
    "event_object",
    "object_object",
    "event_map_type",
    "object_map_type",
}

LEGACY_QUANTITY_TABLES = {SQL_OPERATIONS, SQL_QUANTITIES, SQL_ITEM_PROPERTIES}
"""Tables of the deprecated SQLite quantity extension."""

LOG = "sqlite_log"
"""Alias the SQLite log is attached under."""

SQLITE_TO_OCEL = {
    "TEXT": "string",
    "VARCHAR": "string",
    "STRING": "string",
    "CHAR": "string",
    "INTEGER": "integer",
    "INT": "integer",
    "BIGINT": "integer",
    "REAL": "float",
    "FLOAT": "float",
    "DOUBLE": "float",
    "NUMERIC": "float",
    "DECIMAL": "float",
    "BOOLEAN": "boolean",
    "BOOL": "boolean",
    "TIMESTAMP": "time",
    "DATETIME": "time",
    "DATE": "time",
}
"""What a declared SQLite type means as an OCEL attribute type."""

OCEL_TO_SQLITE = {
    "string": "TEXT",
    "integer": "BIGINT",
    "float": "DOUBLE",
    "boolean": "BOOLEAN",
    "time": "TIMESTAMP",
}
"""The SQLite type an OCEL attribute type is declared as; :data:`SQLITE_TO_OCEL` reads it back."""


def _read_only(source: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{source}?mode=ro", uri=True)


def sqlite_tables(source: str | Path) -> set[str]:
    """The names of the tables the SQLite file holds."""
    with _read_only(Path(source)) as con:
        return {
            name
            for (name,) in con.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }


def declared_types(source: str | Path, table: str) -> dict[str, str]:
    """Each column of ``table``, in table order, with the DuckDB type its declared SQLite type means.

    A column without a declared type, or with one not in :data:`SQLITE_TO_OCEL`,
    is a string.
    """
    with _read_only(Path(source)) as con:
        columns = con.execute(f"PRAGMA table_info({literal(table)})").fetchall()
    return {
        name: ATTRIBUTE_TYPE_TO_DUCKDB[
            SQLITE_TO_OCEL.get((declared or "").upper().split("(")[0].strip(), "string")
        ]
        for _, name, declared, *_ in columns
    }


def _type_tables(source: Path, present: set[str]) -> set[str]:
    """The per-type attribute tables, ``event_<map>`` and ``object_<map>``."""
    type_tables = set()
    with _read_only(source) as con:
        for kind in ("event", "object"):
            if f"{kind}_map_type" not in present:
                continue
            type_tables |= {
                f"{kind}_{type_map}"
                for (type_map,) in con.execute(
                    f'SELECT ocel_type_map FROM "{kind}_map_type"'
                )
            }
    return type_tables


def extra_tables(source: str | Path) -> list[str]:
    """The tables of the SQLite log that are not OCEL tables, sorted."""
    source = Path(source)
    present = sqlite_tables(source)
    standard = OCEL_TABLES | _type_tables(source, present)
    return sorted(
        table
        for table in present
        if table not in standard and not table.startswith("sqlite_")
    )


def copy_tables(
    source: str | Path, con: duckdb.DuckDBPyConnection, tables: list[str]
) -> None:
    """Copy ``tables`` from the SQLite log at ``source`` into ``con``, under their own names.

    Values are read as text and cast to the declared type; a value that does not
    fit its type (SQLite does not enforce types) becomes ``NULL``. A table whose
    name already exists in ``con`` raises instead of being overwritten.

    If a legacy quantity extension table was among them, the copies are converted
    into the quantity tables right away (with a :class:`DeprecationWarning`).
    """
    if not tables:
        return
    source = Path(source)
    types = {table: declared_types(source, table) for table in tables}

    con.execute("INSTALL sqlite; LOAD sqlite;")
    con.execute("SET sqlite_all_varchar = true")
    con.execute(
        f"ATTACH {literal(str(source))} AS {ident(LOG)} (TYPE sqlite, READ_ONLY)"
    )
    try:
        for table, columns in types.items():
            projection = ", ".join(
                f"TRY_CAST({ident(column)} AS {duckdb_type}) AS {ident(column)}"
                for column, duckdb_type in columns.items()
            )
            con.execute(f"""
                CREATE TABLE {ident(table)} AS
                SELECT {projection} FROM {ident(LOG)}.{ident(table)}
            """)
    finally:
        con.execute(f"DETACH {ident(LOG)}")
        con.execute("RESET sqlite_all_varchar")

    if LEGACY_QUANTITY_TABLES & set(tables):
        quantities_from_extras(con)


def import_extras_sqlite(source: str | Path, target: DuckDBTarget) -> None:
    """Copy every extra table of the SQLite log at ``source`` into the DuckDB at ``target``."""
    tables = extra_tables(source)
    if not tables:
        return
    with connect_target(target) as con:
        copy_tables(source, con, tables)


def export_extras_sqlite(
    con: duckdb.DuckDBPyConnection, target: str | Path, tables: list[str]
) -> None:
    """Add every table in ``tables`` to the SQLite log at ``target``, under its own name.

    Column names are kept; each column is declared with the SQLite type its
    DuckDB type maps to, so :func:`declared_types` recovers it on import. A table
    whose name the log already has raises.
    """
    if not tables:
        return
    target = Path(target)
    with sqlite3.connect(target) as sqlite_con:
        for table in tables:
            columns = ", ".join(
                f"{ident(name)} {OCEL_TO_SQLITE[duckdb_to_attribute_type(duckdb_type)]}"
                for name, duckdb_type in column_types(con, table)
            )
            sqlite_con.execute(f"CREATE TABLE {ident(table)} ({columns})")

    con.execute("INSTALL sqlite; LOAD sqlite;")
    con.execute(f"ATTACH {literal(str(target))} AS {ident(LOG)} (TYPE sqlite)")
    try:
        for table in tables:
            con.execute(
                f"INSERT INTO {ident(LOG)}.{ident(table)} BY NAME SELECT * FROM {ident(table)}"
            )
    finally:
        con.execute(f"DETACH {ident(LOG)}")
