"""Streaming importer for OCEL 2.0 SQLite logs into DuckDB.

One statement per type table: each is read once and inserted whole, with its
attributes cast in ``COLUMNS`` groups rather than one pass per attribute. The
type table is the only source of its own rows -- the core ``event``/``object``
tables are consulted only where they hold something the type tables do not.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Literal, NamedTuple

import duckdb
import pyarrow as pa

from ocelescope.ocel.constants.misc import EPOCH_SQL
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.quantity import SQL_ITEM_PROPERTIES
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.importers.quantities import import_quantities_sqlite
from ocelescope.ocel.io.schema import (
    TIMESTAMP_TYPE,
    SchemaDefinition,
    create_ocel_tables,
    merge_columns,
)
from ocelescope.util.sql import ident, literal, utc_timestamp

SQLITE_OCEL_ID_FIELD = "ocel_id"
SQLITE_OCEL_TYPE_FIELD = "ocel_type"
SQLITE_OCEL_TIMESTAMP_FIELD = "ocel_time"
SQLITE_OCEL_CHANGE_FIELD = "ocel_changed_field"

SQLITE_OBJECT_TABLE = "object"
SQLITE_E2O_TABLE = "event_object"
SQLITE_O2O_TABLE = "object_object"

SQLITE_O2O_SOURCE_FIELD = "ocel_source_id"
SQLITE_O2O_TARGET_FIELD = "ocel_target_id"
SQLITE_QUALIFIER_FIELD = "ocel_qualifier"
SQLITE_E2O_EVENT_FIELD = "ocel_event_id"
SQLITE_E2O_OBJECT_FIELD = "ocel_object_id"

SQLITE_OCEL_META_FIELDS = [
    SQLITE_OCEL_ID_FIELD,
    SQLITE_OCEL_TYPE_FIELD,
    SQLITE_OCEL_TIMESTAMP_FIELD,
    SQLITE_OCEL_CHANGE_FIELD,
    EID_COL,
    ACTIVITY_COL,
    TIMESTAMP_COL,
    OID_COL,
    OTYPE_COL,
]

_SQLITE_TYPE_TO_ARROW: dict[str, pa.DataType] = {
    "TEXT": pa.string(),
    "VARCHAR": pa.string(),
    "STRING": pa.string(),
    "CHAR": pa.string(),
    "INTEGER": pa.int64(),
    "INT": pa.int64(),
    "BIGINT": pa.int64(),
    "REAL": pa.float64(),
    "FLOAT": pa.float64(),
    "DOUBLE": pa.float64(),
    "NUMERIC": pa.float64(),
    "DECIMAL": pa.float64(),
    "BOOLEAN": pa.bool_(),
    "BOOL": pa.bool_(),
    "TIMESTAMP": TIMESTAMP_TYPE,
    "DATETIME": TIMESTAMP_TYPE,
    "DATE": TIMESTAMP_TYPE,
}

_ARROW_TO_DUCKDB_CAST: dict[pa.DataType, str] = {
    pa.int64(): "BIGINT",
    pa.float64(): "DOUBLE",
    pa.bool_(): "BOOLEAN",
}


#: Groups one attribute change on its own during the object_changes reshape. The
#: source row's identity is not enough: several attributes can change at one
#: instant, and grouping by ``(id, time)`` would merge them back into one row.
_CHANGE_KEY = "__ocel_change"


class TypeTable(NamedTuple):
    """One ``event_<suffix>`` / ``object_<suffix>`` table's discovered layout."""

    name: str
    time_column: str | None
    attributes: dict[str, pa.DataType]
    changed_field: bool = False

    @property
    def stored_time(self) -> str:
        """SQL for this table's timestamp, NULL when it keeps none."""
        return utc_timestamp(ident(self.time_column)) if self.time_column else "NULL"

    @property
    def stored_changed_field(self) -> str:
        """SQL projecting this table's ``ocel_changed_field``, NULL when it keeps none.

        Only object tables carry one, and even there it is optional -- a log whose
        object attributes never change has no field to name.
        """
        column = ident(SQLITE_OCEL_CHANGE_FIELD)
        return column if self.changed_field else f"NULL::VARCHAR AS {column}"


TypeTables = dict[str, TypeTable]


def read_type_tables(source: Path, type: Literal["event", "object"]) -> TypeTables:
    """Map each OCEL type to its type table and that table's attribute types.

    Read over a plain sqlite3 connection rather than DuckDB, and before the file
    is attached: ``sqlite_all_varchar`` makes every column report back as VARCHAR,
    so ``PRAGMA table_info`` is the only place the declared types are still
    legible. It is metadata-only, so nothing but the schema is loaded here.

    A type the map declares but whose table is absent is skipped. ``PRAGMA
    table_info`` answers for a missing table with no rows rather than an error, so
    without this it would be recorded as a type with no attributes and only fail
    later, when its INSERT reaches a table that was never there.
    """
    type_tables: TypeTables = {}
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as sqlite_con:
        cur = sqlite_con.cursor()
        present = {
            row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        map_table = f"{type}_map_type"
        if map_table not in present:
            return {}
        types = cur.execute(f"SELECT ocel_type, ocel_type_map FROM {ident(map_table)}").fetchall()
        for ocel_type, suffix in types:
            table = f"{type}_{suffix}"
            if table not in present:
                continue
            columns = [
                (row[1], row[2]) for row in cur.execute(f"PRAGMA table_info({ident(table)})")
            ]
            type_tables[ocel_type] = TypeTable(
                name=table,
                time_column=(
                    SQLITE_OCEL_TIMESTAMP_FIELD
                    if any(name == SQLITE_OCEL_TIMESTAMP_FIELD for name, _ in columns)
                    else None
                ),
                changed_field=any(name == SQLITE_OCEL_CHANGE_FIELD for name, _ in columns),
                attributes={
                    name: _SQLITE_TYPE_TO_ARROW.get(
                        (sqlite_type or "").upper().split("(")[0].strip(), pa.string()
                    )
                    for name, sqlite_type in columns
                    if name not in SQLITE_OCEL_META_FIELDS
                },
            )
    return type_tables


def get_attribute_columns(type_tables: TypeTables) -> SchemaDefinition:
    """Collapse the per-type attributes into one column per name."""
    return merge_columns(
        [attribute for table in type_tables.values() for attribute in table.attributes.items()]
    )


def attribute_selects(attributes: dict[str, pa.DataType]) -> str:
    """Project a type table's attributes, casting the non-text ones.

    Every source column is attached as VARCHAR (see ``sqlite_all_varchar``), so a
    numeric/boolean/timestamp attribute is cast into its real type here.
    ``TRY_CAST`` yields NULL instead of erroring on a value that contradicts its
    declared type -- OCEL SQLite files in the wild store things like the literal
    text ``'null'`` in a REAL column, and an implicit cast on insert would fail
    the whole statement over one cell.

    Attributes sharing a target type are cast as one ``COLUMNS`` group, so this
    stays a handful of expressions however wide the type table is. ``COLUMNS``
    keeps each column's own name, which is what lets the caller insert ``BY
    NAME``. Each group is emitted with a *leading* comma so a type table with no
    attributes at all contributes nothing rather than a dangling separator.
    """
    groups: dict[pa.DataType, list[str]] = {}
    for name, arrow_type in attributes.items():
        groups.setdefault(arrow_type, []).append(name)

    selects = []
    for arrow_type, names in groups.items():
        columns = f"COLUMNS([{', '.join(literal(name) for name in names)}])"
        duckdb_type = _ARROW_TO_DUCKDB_CAST.get(arrow_type)
        if arrow_type == TIMESTAMP_TYPE:
            selects.append(utc_timestamp(columns))
        elif duckdb_type is not None:
            selects.append(f"TRY_CAST({columns} AS {duckdb_type})")
        else:
            selects.append(columns)
    return "".join(f",\n        {select}" for select in selects)


def _insert_events(con: duckdb.DuckDBPyConnection, type_tables: TypeTables) -> None:
    """Fill ``events``, one statement per event type.

    The type table is the only source read: it holds every event of its type
    together with that type's attributes, and the activity name is already known
    from the map, so it goes in as a literal. Joining the core ``event`` table to
    recover it would be worse than redundant -- an event the type table lists but
    core does not would be dropped by the join, which real files do contain.

    Columns the shared wide ``events`` table has but this type does not are left
    to ``BY NAME``, which fills them with NULL.
    """
    for activity_type, table in type_tables.items():
        con.execute(f"""
            INSERT INTO
            {ident(EVENTS_TABLE)} BY NAME
            SELECT
            {ident(SQLITE_OCEL_ID_FIELD)} as {ident(EID_COL)},
            {literal(activity_type)} as {ident(ACTIVITY_COL)},
            {table.stored_time} as {ident(TIMESTAMP_COL)}{attribute_selects(table.attributes)}
            FROM
            src.{ident(table.name)}
        """)


def _insert_object_changes(con: duckdb.DuckDBPyConnection, type_tables: TypeTables) -> None:
    """Fill ``object_changes``, one statement per object type.

    :func:`_insert_objects`).
    """
    for table in type_tables.values():
        if not table.attributes:
            continue

        meta = [SQLITE_OCEL_ID_FIELD] + ([table.time_column] if table.time_column else [])
        meta_sql = ", ".join(ident(column) for column in meta)
        names = ", ".join(ident(name) for name in table.attributes)
        quoted_names = ", ".join(literal(name) for name in table.attributes)
        as_text = ", ".join(f"{ident(name)}::VARCHAR AS {ident(name)}" for name in table.attributes)
        field = ident(OBJECT_CHANGED_FIELD)

        con.execute(f"""
            INSERT INTO
            {ident(OBJECT_CHANGES_TABLE)} BY NAME
            SELECT
            {ident(SQLITE_OCEL_ID_FIELD)} as {ident(OID_COL)},
            COALESCE({table.stored_time}, {EPOCH_SQL}) as {ident(TIMESTAMP_COL)},
            {field}{attribute_selects(table.attributes)}
            FROM
            (
                PIVOT (
                    SELECT *, row_number() OVER () AS {ident(_CHANGE_KEY)}
                    FROM (
                        SELECT {meta_sql}, name, name AS {field},
                               NULLIF(value, '') AS value
                        FROM (
                            UNPIVOT (
                                SELECT {meta_sql}, {table.stored_changed_field}, {as_text}
                                FROM src.{ident(table.name)}
                            )
                            ON {names}
                        )
                        WHERE {ident(SQLITE_OCEL_CHANGE_FIELD)} IS NOT NULL
                           OR (value IS NOT NULL AND value <> '')
                    )
                )
                ON name IN ({quoted_names})
                USING first(value)
                GROUP BY {ident(_CHANGE_KEY)}, {meta_sql}, {field}
            )
        """)


def _insert_objects(con: duckdb.DuckDBPyConnection) -> None:
    """Fill the ``objects`` snapshot from the core table and ``object_changes``."""
    con.execute(f"""
        INSERT INTO
        {ident(OBJECTS_TABLE)} BY NAME
        SELECT
        *
        FROM
        (
            SELECT
            {ident(SQLITE_OCEL_ID_FIELD)} as {ident(OID_COL)},
            {ident(SQLITE_OCEL_TYPE_FIELD)} as {ident(OTYPE_COL)}
            FROM
            src.{ident(SQLITE_OBJECT_TABLE)}
        )
        LEFT JOIN (
            SELECT
            {ident(OID_COL)},
            arg_min(COLUMNS (* EXCLUDE ({ident(OID_COL)}, {ident(TIMESTAMP_COL)}, {ident(OBJECT_CHANGED_FIELD)})), {ident(TIMESTAMP_COL)})
            FROM
            {ident(OBJECT_CHANGES_TABLE)}
            GROUP BY
            {ident(OID_COL)}
        ) USING ({ident(OID_COL)})
    """)


def _insert_o2o(con: duckdb.DuckDBPyConnection) -> None:
    """Copy the object-to-object relations across."""
    con.execute(f"""
        INSERT INTO
        {ident(O2O_TABLE)} BY NAME
        SELECT
            {ident(SQLITE_O2O_SOURCE_FIELD)} as {ident(O2O_SOURCE_ID)},
            {ident(SQLITE_O2O_TARGET_FIELD)} as {ident(O2O_TARGET_ID)},
            {ident(SQLITE_QUALIFIER_FIELD)} as {ident(O2O_QUALIFIER)}
        FROM
            src.{ident(SQLITE_O2O_TABLE)}
    """)


def _insert_e2o(con: duckdb.DuckDBPyConnection) -> None:
    """Copy the event-to-object relations across."""
    con.execute(f"""
        INSERT INTO
        {ident(E2O_TABLE)} BY NAME
        SELECT
            {ident(SQLITE_E2O_EVENT_FIELD)} as {ident(EID_COL)},
            {ident(SQLITE_E2O_OBJECT_FIELD)} as {ident(OID_COL)},
            {ident(SQLITE_QUALIFIER_FIELD)} as {ident(E2O_QUALIFIER)}
        FROM
            src.{ident(SQLITE_E2O_TABLE)}
    """)


def _property_casts(source: Path) -> tuple[set[str], dict[str, str]]:
    """The file's table names, and DuckDB types for the quantity item properties.

    The property types are only legible before the file is attached with
    ``sqlite_all_varchar``. Only the columns that map to a non-text type are
    listed -- the rest are already text and need no cast.
    """
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as sqlite_con:
        cur = sqlite_con.cursor()
        present = {
            row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        casts: dict[str, str] = {}
        if SQL_ITEM_PROPERTIES in present:
            for row in cur.execute(f"PRAGMA table_info({ident(SQL_ITEM_PROPERTIES)})"):
                base = (row[2] or "").upper().split("(", 1)[0].strip()
                duckdb_type = _ARROW_TO_DUCKDB_CAST.get(
                    _SQLITE_TYPE_TO_ARROW.get(base, pa.string())
                )
                if duckdb_type is not None:
                    casts[row[1]] = duckdb_type
    return present, casts


def import_ocel_sqlite(source: str | Path, target: DuckDBTarget) -> None:
    """Stream an OCEL 2.0 SQLite log into the DuckDB database at ``target``."""
    source = Path(source)

    event_type_tables = read_type_tables(source, "event")
    object_type_tables = read_type_tables(source, "object")
    present, property_casts = _property_casts(source)

    with connect_target(target) as con:
        create_ocel_tables(
            con,
            object_columns=get_attribute_columns(object_type_tables),
            event_columns=get_attribute_columns(event_type_tables),
        )

        con.execute("INSTALL sqlite; LOAD sqlite;")
        con.execute("SET GLOBAL sqlite_all_varchar=true")
        con.execute(f"ATTACH '{source}' AS src (TYPE sqlite, READ_ONLY)")

        try:
            _insert_events(con, event_type_tables)
            _insert_object_changes(con, object_type_tables)
            _insert_objects(con)

            if SQLITE_O2O_TABLE in present:
                _insert_o2o(con)
            if SQLITE_E2O_TABLE in present:
                _insert_e2o(con)

            import_quantities_sqlite(con, present, property_casts)
        finally:
            con.execute("DETACH src")
