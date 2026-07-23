"""Streaming importer for OCEL 2.0 SQLite logs into DuckDB."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import duckdb
import pyarrow as pa

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
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
    SchemaDefinition,
    create_ocel_tables,
    merge_columns,
)
from ocelescope.util.sql import ident, literal

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
    "TIMESTAMP": pa.timestamp("us", tz="UTC"),
    "DATETIME": pa.timestamp("us", tz="UTC"),
    "DATE": pa.timestamp("us", tz="UTC"),
}


_ARROW_TO_DUCKDB_CAST: dict[pa.DataType, str] = {
    pa.int64(): "BIGINT",
    pa.float64(): "DOUBLE",
    pa.bool_(): "BOOLEAN",
    pa.timestamp("us", tz="UTC"): "TIMESTAMPTZ",
}

_EARLIEST = "'-infinity'::TIMESTAMPTZ"

_TIME_COLUMNS = ("ocel_time", "ocel:timestamp", "ocel:time")

_CHANGED_FIELD_COLUMNS = ("ocel_changed_field", "ocel:field")

_META_COLUMNS = {
    "ocel_id",
    "ocel_type",
    "ocel:type",
    "ocel:activity",
    "@@cumcount",
    *_TIME_COLUMNS,
    *_CHANGED_FIELD_COLUMNS,
}


def _arrow_type(sqlite_type: str | None) -> pa.DataType:
    """Map a SQLite declared column type to an Arrow type (default ``string``)."""
    base = (sqlite_type or "").upper().split("(", 1)[0].strip()
    return _SQLITE_TYPE_TO_ARROW.get(base, pa.string())


def _cast_expr(name: str, arrow_type: pa.DataType) -> str:
    """SQL expression reading attribute ``name`` as its target type.

    Every source column is attached as VARCHAR (see ``sqlite_all_varchar``), so a
    numeric/boolean/timestamp attribute is ``TRY_CAST`` into its real type here.
    ``TRY_CAST`` yields NULL instead of erroring on dirty values -- OCEL SQLite
    files in the wild store things like the literal text ``'null'`` in a REAL
    column. String attributes are already text and pass through unchanged.
    """
    quoted = ident(name)
    duckdb_type = _ARROW_TO_DUCKDB_CAST.get(arrow_type)
    return quoted if duckdb_type is None else f"TRY_CAST({quoted} AS {duckdb_type})"


def _timestamp_expr(column: str) -> str:
    """SQL expression casting a text time column to a UTC ``TIMESTAMPTZ``.

    With ``sqlite_all_varchar`` on, the column keeps its raw ISO-8601 text
    (carrying its ``Z``/``+00:00`` offset), so a direct cast lands on the correct
    UTC instant. ``TRY_CAST`` guards against malformed timestamps.
    """
    return f"TRY_CAST({ident(column)} AS TIMESTAMPTZ)"


def _order_expr(time_column: str | None) -> str:
    """Ordering key for "earliest value wins", with an untimed row counting first.

    A row with no time is an object's initial snapshot -- the format leaves
    ``ocel_time`` empty on it, since initial values happen before anything. But
    NULL expresses the opposite of that to both of the things we rank with:
    DuckDB's ``ORDER BY`` sorts NULLs *last*, and ``arg_min`` skips a row whose
    key is NULL rather than treating it as the minimum. Either way the snapshot
    loses to the first real change, which is exactly backwards.

    ``-infinity`` says "earliest" in a way both respect. When the type table has
    no time column at all there are no changes to order against, so every row is
    equally earliest and any value wins -- as opposed to ``NULL``, which would
    make ``arg_min`` discard every row and null the whole type's attributes.
    """
    if time_column is None:
        return _EARLIEST
    return f"COALESCE({_timestamp_expr(time_column)}, {_EARLIEST})"


class _TypeTable:
    """Discovered layout of one ``event_<suffix>`` / ``object_<suffix>`` table.

    Given the raw column list of a type table, this splits each column into:

    * ``time_column`` -- the row timestamp (its name differs across dialects)
    * ``attributes``  -- everything that is not a known meta column, i.e. the
      real user attributes, each paired with its Arrow type

    The change-marker column (``ocel_changed_field`` / ``ocel:field``) is skipped
    as meta; the initial-vs-change split is derived from timestamps instead (see
    :func:`_insert_objects`), so it does not need to be tracked here.
    """

    def __init__(self, name: str, ocel_type: str, columns: list[tuple[str, str]]):
        self.name = name
        self.ocel_type = ocel_type
        self.time_column: str | None = None
        self.attributes: SchemaDefinition = []

        for column, sqlite_type in columns:
            if column in _TIME_COLUMNS and self.time_column is None:
                self.time_column = column
            elif column not in _META_COLUMNS:
                self.attributes.append((column, _arrow_type(sqlite_type)))


def _table_names(cur: sqlite3.Cursor) -> set[str]:
    """Return the set of table names in the SQLite file (used for existence checks)."""
    return {row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}


def _type_map(cur: sqlite3.Cursor, map_table: str, present: set[str]) -> dict[str, str]:
    """Map each real OCEL type name to its table suffix, if the map table exists.

    e.g. from ``event_map_type`` -> ``{"place order": "PlaceOrder", "pay": "Pay"}``.
    Returns empty if the map table is missing (e.g. a log with no events).
    """
    if map_table not in present:
        return {}
    return {
        row[0]: row[1]
        for row in cur.execute(f"SELECT ocel_type, ocel_type_map FROM {ident(map_table)}")
    }


def _discover(
    cur: sqlite3.Cursor, prefix: str, map_table: str, present: set[str]
) -> list[_TypeTable]:
    """Read every ``<prefix>_<suffix>`` type table declared in ``map_table``.

    ``prefix`` is "event" or "object". For each type we look up the physical
    table name via the map, then read its columns with ``PRAGMA table_info`` --
    a metadata-only query, so nothing but the schema is loaded here.
    """
    tables: list[_TypeTable] = []
    for ocel_type, suffix in _type_map(cur, map_table, present).items():
        name = f"{prefix}_{suffix}"
        if name not in present:
            continue

        columns = [(row[1], row[2]) for row in cur.execute(f"PRAGMA table_info({ident(name)})")]
        tables.append(_TypeTable(name, ocel_type, columns))
    return tables


def _insert(
    con: duckdb.DuckDBPyConnection,
    target: str,
    columns: list[str],
    select: list[str],
    source: str,
    where: str | None = None,
) -> None:
    """Run one ``INSERT INTO target (columns) SELECT select FROM src.source``.

    ``target`` is a DuckDB output table, ``source`` a table in the attached
    SQLite file (referenced as ``src.<name>``). ``columns`` are the target
    columns to fill; ``select`` are the matching source expressions (already
    quoted/escaped). Target columns not listed here stay NULL -- that is how one
    type table, which only knows its own attributes, fills the shared wide
    ``events``/``objects`` tables. DuckDB streams the rows, so this stays cheap.
    """
    column_sql = ", ".join(ident(column) for column in columns)
    filter_sql = f" WHERE {where}" if where else ""
    con.execute(
        f"INSERT INTO {ident(target)} ({column_sql}) "
        f"SELECT {', '.join(select)} FROM src.{ident(source)}{filter_sql}"
    )


def _insert_objects(con: duckdb.DuckDBPyConnection, table: _TypeTable) -> None:
    """Fill the ``objects`` snapshot for one object type.

    Object types with no attributes have an empty (or absent) type table, so the
    id/type of *every* object is taken from the core ``object`` table -- driving
    off the type tables would silently drop those objects. Each attribute's
    initial value is its earliest non-NULL value, computed with ``arg_min`` over
    the timestamp and LEFT JOINed on the object id. That "earliest value wins"
    rule reproduces OCELWriter's split and is dialect-independent: it needs no
    explicit initial-snapshot row, so files that store one (pm4py) and files that
    store only per-field change rows both come out the same.
    """
    otype = literal(table.ocel_type)
    columns = ", ".join(ident(c) for c in [OID_COL, OTYPE_COL, *(n for n, _ in table.attributes)])

    if not table.attributes:
        con.execute(
            f'INSERT INTO "{OBJECTS_TABLE}" ({columns}) '
            f'SELECT "ocel_id", {otype} FROM src."object" WHERE "ocel_type" = {otype}'
        )
        return

    order_key = _order_expr(table.time_column)
    initial = ", ".join(
        f"arg_min({_cast_expr(name, dtype)}, {order_key}) AS {ident(name)}"
        for name, dtype in table.attributes
    )
    projected = ", ".join(f"snapshot.{ident(name)}" for name, _ in table.attributes)
    con.execute(
        f'INSERT INTO "{OBJECTS_TABLE}" ({columns}) '
        f'SELECT core."ocel_id", {otype}, {projected} '
        f'FROM src."object" core LEFT JOIN ('
        f'SELECT "ocel_id", {initial} FROM src.{ident(table.name)} GROUP BY "ocel_id"'
        f') snapshot ON core."ocel_id" = snapshot."ocel_id" '
        f'WHERE core."ocel_type" = {otype}'
    )


def _insert_object_changes(con: duckdb.DuckDBPyConnection, table: _TypeTable) -> None:
    """Fill ``object_changes`` with every attribute value in the type table.

    One INSERT per attribute: each row's non-NULL cells are fanned out into one
    ``object_changes`` row per attribute, so a row that sets several attributes
    at once (e.g. an initial snapshot) is split into single-attribute rows --
    the shape OCELWriter produces. Nothing is filtered beyond that:
    ``object_changes`` is the full value history, initial values included,
    while ``objects`` caches each attribute's earliest value (see
    :func:`_insert_objects`). The stored timestamp is kept as-is -- NULL when
    the row (or the whole type table) has no time.
    """
    stored_time = _timestamp_expr(table.time_column) if table.time_column else "NULL"
    for name, dtype in table.attributes:
        cast = _cast_expr(name, dtype)
        con.execute(
            f'INSERT INTO "{OBJECT_CHANGES_TABLE}" '
            f"({ident(OID_COL)}, {ident(TIMESTAMP_COL)}, {ident(name)}) "
            f'SELECT "ocel_id", {stored_time}, {cast} FROM src.{ident(table.name)} '
            f"WHERE {cast} IS NOT NULL"
        )


def _property_casts(cur: sqlite3.Cursor, present: set[str]) -> dict[str, str]:
    """DuckDB types to read the quantity item-property columns back as.

    Their declared types are only legible here, before the file is attached with
    ``sqlite_all_varchar``. Only the columns that map to a non-text type are
    listed -- the rest are already text and need no cast.
    """
    if SQL_ITEM_PROPERTIES not in present:
        return {}
    casts = {}
    for row in cur.execute(f"PRAGMA table_info({ident(SQL_ITEM_PROPERTIES)})"):
        duckdb_type = _ARROW_TO_DUCKDB_CAST.get(_arrow_type(row[2]))
        if duckdb_type is not None:
            casts[row[1]] = duckdb_type
    return casts


def import_ocel_sqlite(source: str | Path, target: DuckDBTarget) -> None:
    """Stream an OCEL 2.0 SQLite log into the DuckDB database at ``target``."""

    with sqlite3.connect(f"file:{Path(source)}?mode=ro", uri=True) as sqlite_con:
        cur = sqlite_con.cursor()
        present = _table_names(cur)
        event_tables = _discover(cur, "event", "event_map_type", present)
        object_tables = _discover(cur, "object", "object_map_type", present)
        property_casts = _property_casts(cur, present)

    event_columns = merge_columns([attr for table in event_tables for attr in table.attributes])
    object_columns = merge_columns([attr for table in object_tables for attr in table.attributes])

    with connect_target(target) as con:
        create_ocel_tables(con, object_columns, event_columns)

        con.execute("INSTALL sqlite; LOAD sqlite;")
        con.execute("SET GLOBAL sqlite_all_varchar=true")
        con.execute(f"ATTACH '{Path(source)}' AS src (TYPE sqlite, READ_ONLY)")

        try:
            for table in event_tables:
                time = _timestamp_expr(table.time_column) if table.time_column else "NULL"
                attr_names = [name for name, _ in table.attributes]
                attr_select = [_cast_expr(name, dtype) for name, dtype in table.attributes]
                _insert(
                    con,
                    EVENTS_TABLE,
                    [EID_COL, ACTIVITY_COL, TIMESTAMP_COL, *attr_names],
                    ['"ocel_id"', literal(table.ocel_type), time, *attr_select],
                    table.name,
                )

            for table in object_tables:
                _insert_objects(con, table)
                _insert_object_changes(con, table)

            if "object_object" in present:
                _insert(
                    con,
                    O2O_TABLE,
                    [O2O_SOURCE_ID, O2O_QUALIFIER, O2O_TARGET_ID],
                    ['"ocel_source_id"', '"ocel_qualifier"', '"ocel_target_id"'],
                    "object_object",
                )
            if "event_object" in present:
                _insert(
                    con,
                    E2O_TABLE,
                    [EID_COL, E2O_QUALIFIER, OID_COL],
                    ['"ocel_event_id"', '"ocel_qualifier"', '"ocel_object_id"'],
                    "event_object",
                )

            import_quantities_sqlite(con, present, property_casts)
        finally:
            con.execute("DETACH src")
