"""Read and write the quantity extension of a SQLite OCEL log.

The SQLite counterpart of :mod:`~ocelescope.ocel.io.quantities.json` and
:mod:`~ocelescope.ocel.io.quantities.xml`, and the one format where the extension
is neither text to append nor a subtree to slice: it is three more tables in the
log's own database. Both directions therefore attach the file and let DuckDB
stream the copy, so nothing flows through Python.

What does have to go through Python is SQLite's declared column types. DuckDB
reads a declared ``BOOLEAN`` back as ``BIGINT`` (SQLite has no boolean of its
own), and its ``CREATE TABLE ... AS SELECT`` only ever declares
``VARCHAR``/``BIGINT``/``DOUBLE`` -- so an item property would lose its type in
either direction. The declared types are legible only through ``sqlite3``, which
is where :func:`_property_casts` reads them and :func:`_create_item_properties`
writes them.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import duckdb

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_DUCKDB
from ocelescope.util.sql import ident, literal

SQL_OPERATIONS = "operation"
SQL_QUANTITIES = "quantity"
SQL_ITEM_PROPERTIES = "itemProperties"

SQL_KEYMAP = {
    EID_COL: "ocel_event_id",
    OID_COL: "ocel_object_id",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}
"""Our column name -> the column a SQLite log spells it with."""

LOG = "quantity_log"
"""Alias the SQLite log is attached under, at either end."""

_SQLITE_TO_OCEL = {
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


def _ocel_to_sqlite(duckdb_type: str) -> str:
    """A SQLite column type an import maps back to ``duckdb_type``.

    Declared, not stored: SQLite keeps a column's type as text and its values as
    whatever was written. Declaring ``BOOLEAN`` or ``TIMESTAMP`` is what lets
    :func:`_property_casts` recover a type that would otherwise read back as an
    integer or a string.
    """
    t = duckdb_type.upper()
    if "BOOL" in t:
        return "BOOLEAN"
    if "TIMESTAMP" in t or "DATE" in t or t == "TIME":
        return "TIMESTAMP"
    if "INT" in t:
        return "BIGINT"
    if any(kind in t for kind in ("DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC")):
        return "DOUBLE"
    return "TEXT"


def _tables(source: Path) -> set[str]:
    """The names of the tables the SQLite file holds."""
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as con:
        return {
            row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }


def _property_casts(source: Path) -> dict[str, str]:
    """Each item-property column with the DuckDB type its declared type means.

    Read through ``sqlite3`` because the declared types are what DuckDB has
    already interpreted (and flattened) by the time the file is attached.
    """
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as con:
        columns = con.execute(f'PRAGMA table_info("{SQL_ITEM_PROPERTIES}")').fetchall()

    casts = {}
    for _, name, declared, *_ in columns:
        ocel_type = _SQLITE_TO_OCEL.get((declared or "").upper().split("(")[0].strip(), "string")
        casts[name] = ATTRIBUTE_TYPE_TO_DUCKDB[ocel_type]
    return casts


def import_quantities_sqlite(source: str | Path, target: DuckDBTarget) -> None:
    """Add the quantity-extension tables from a SQLite log to the DuckDB at ``target``.

    The file is attached and each table copied by a single ``CREATE OR REPLACE
    TABLE ... AS SELECT``, which DuckDB streams internally. An extension table
    the file does not have is left alone, keeping the empty form
    :func:`~ocelescope.ocel.io.schema.ensure_quantity_tables` gave it.
    """
    source = Path(source)
    present = _tables(source)
    if not present & {SQL_QUANTITIES, SQL_OPERATIONS, SQL_ITEM_PROPERTIES}:
        return

    casts = _property_casts(source) if SQL_ITEM_PROPERTIES in present else {}

    with connect_target(target) as con:
        con.execute("INSTALL sqlite; LOAD sqlite;")
        con.execute(f"ATTACH {literal(str(source))} AS {ident(LOG)} (TYPE sqlite, READ_ONLY)")
        try:
            if SQL_QUANTITIES in present:
                con.execute(f"""
                    CREATE OR REPLACE TABLE {ident(QUANTITIES_TABLE)} AS SELECT
                    {ident(SQL_KEYMAP[OID_COL])} AS {ident(OID_COL)},
                    {ident(SQL_KEYMAP[QEL_ITEM_TYPE])} AS {ident(QEL_ITEM_TYPE)},
                    TRY_CAST({ident(SQL_KEYMAP[QEL_QUANTITY])} AS DOUBLE) AS {ident(QEL_QUANTITY)}
                    FROM {ident(LOG)}.{ident(SQL_QUANTITIES)}
                """)

            if SQL_OPERATIONS in present:
                con.execute(f"""
                    CREATE OR REPLACE TABLE {ident(QUANTITY_OPERATIONS_TABLE)} AS SELECT
                    {ident(SQL_KEYMAP[EID_COL])} AS {ident(EID_COL)},
                    {ident(SQL_KEYMAP[OID_COL])} AS {ident(OID_COL)},
                    {ident(SQL_KEYMAP[QEL_ITEM_TYPE])} AS {ident(QEL_ITEM_TYPE)},
                    TRY_CAST({ident(SQL_KEYMAP[QEL_QUANTITY])} AS DOUBLE) AS {ident(QEL_QUANTITY)}
                    FROM {ident(LOG)}.{ident(SQL_OPERATIONS)}
                """)

            if SQL_ITEM_PROPERTIES in present:
                type_column = SQL_KEYMAP[QEL_ITEM_TYPE]
                projection = ", ".join(
                    f"{ident(column)} AS {ident(QEL_ITEM_TYPE)}"
                    if column == type_column
                    else f"TRY_CAST({ident(column)} AS {cast}) AS {ident(column)}"
                    for column, cast in casts.items()
                )
                con.execute(f"""
                    CREATE OR REPLACE TABLE {ident(QUANTITY_ITEM_PROPERTIES_TABLE)} AS
                    SELECT {projection} FROM {ident(LOG)}.{ident(SQL_ITEM_PROPERTIES)}
                """)
        finally:
            con.execute(f"DETACH {ident(LOG)}")


def _has_rows(con: duckdb.DuckDBPyConnection, table: str) -> bool:
    """Whether ``table`` holds a row.

    Rows, not tables: every OCEL carries the three extension tables, so their
    presence says nothing about the log. A log without an extension must not grow
    one on the way out.
    """
    return con.execute(f"SELECT 1 FROM {ident(table)} LIMIT 1").fetchone() is not None


def _item_properties_ddl(con: duckdb.DuckDBPyConnection) -> list[tuple[str, str]]:
    """The ``itemProperties`` columns as ``(name, SQLite type)``, in table order."""
    type_column = SQL_KEYMAP[QEL_ITEM_TYPE]
    return [
        (type_column if name == QEL_ITEM_TYPE else name, _ocel_to_sqlite(dtype))
        for name, dtype, *_ in con.execute(
            f"DESCRIBE {ident(QUANTITY_ITEM_PROPERTIES_TABLE)}"
        ).fetchall()
    ]


def _create_item_properties(target: Path, ddl: list[tuple[str, str]]) -> None:
    """Create the ``itemProperties`` table with its types spelled out.

    Through ``sqlite3`` rather than DuckDB, because DuckDB's ``CREATE TABLE ...
    AS SELECT`` declares every column ``VARCHAR``/``BIGINT``/``DOUBLE`` -- which
    would read back as string, integer and float, losing ``boolean`` and ``time``.
    """
    columns = ", ".join(f'"{name}" {sqlite_type}' for name, sqlite_type in ddl)
    with sqlite3.connect(target) as con:
        con.execute(f'DROP TABLE IF EXISTS "{SQL_ITEM_PROPERTIES}"')
        con.execute(f'CREATE TABLE "{SQL_ITEM_PROPERTIES}" ({columns})')


def export_quantities_sqlite(con: duckdb.DuckDBPyConnection, target: str | Path) -> None:
    """Add the quantity-extension tables to the SQLite log at ``target``.

    The log is written by r4pm, which knows nothing of the extension, so the three
    tables are added afterwards -- attached and filled by DuckDB, except for the
    one table whose declared types have to be written by hand (see
    :func:`_create_item_properties`). A log whose three tables are all empty is
    left exactly as it was.
    """
    target = Path(target)
    quantities = _has_rows(con, QUANTITIES_TABLE)
    operations = _has_rows(con, QUANTITY_OPERATIONS_TABLE)
    item_properties = _has_rows(con, QUANTITY_ITEM_PROPERTIES_TABLE)
    if not (quantities or operations or item_properties):
        return

    if item_properties:
        _create_item_properties(target, _item_properties_ddl(con))

    con.execute("INSTALL sqlite; LOAD sqlite;")
    con.execute(f"ATTACH {literal(str(target))} AS {ident(LOG)} (TYPE sqlite)")
    try:
        if quantities:
            con.execute(f"""
                CREATE OR REPLACE TABLE {ident(LOG)}.{ident(SQL_QUANTITIES)} AS SELECT
                {ident(OID_COL)} AS {ident(SQL_KEYMAP[OID_COL])},
                {ident(QEL_ITEM_TYPE)} AS {ident(SQL_KEYMAP[QEL_ITEM_TYPE])},
                {ident(QEL_QUANTITY)} AS {ident(SQL_KEYMAP[QEL_QUANTITY])}
                FROM {ident(QUANTITIES_TABLE)}
            """)

        if operations:
            con.execute(f"""
                CREATE OR REPLACE TABLE {ident(LOG)}.{ident(SQL_OPERATIONS)} AS SELECT
                {ident(EID_COL)} AS {ident(SQL_KEYMAP[EID_COL])},
                {ident(OID_COL)} AS {ident(SQL_KEYMAP[OID_COL])},
                {ident(QEL_ITEM_TYPE)} AS {ident(SQL_KEYMAP[QEL_ITEM_TYPE])},
                {ident(QEL_QUANTITY)} AS {ident(SQL_KEYMAP[QEL_QUANTITY])}
                FROM {ident(QUANTITY_OPERATIONS_TABLE)}
            """)

        if item_properties:
            # INSERT, not CREATE: the table is already there with its declared types.
            names = [name for name, _ in _item_properties_ddl(con)]
            columns = ", ".join(ident(name) for name in names)
            projection = ", ".join(
                f"{ident(QEL_ITEM_TYPE)}" if name == SQL_KEYMAP[QEL_ITEM_TYPE] else ident(name)
                for name in names
            )
            con.execute(f"""
                INSERT INTO {ident(LOG)}.{ident(SQL_ITEM_PROPERTIES)} ({columns})
                SELECT {projection} FROM {ident(QUANTITY_ITEM_PROPERTIES_TABLE)}
            """)
    finally:
        con.execute(f"DETACH {ident(LOG)}")
