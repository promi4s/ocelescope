"""Streaming importer for OCEL 2.0 SQLite logs into DuckDB.

Reads a log stored in the OCEL 2.0 SQLite format
(https://www.ocel-standard.org/specification/formats/sqlite/) by attaching the
file to DuckDB and moving every table across with a single ``INSERT ... SELECT``.
DuckDB streams the rows internally, so the log never has to be materialised in
Python memory, and the resulting five OCEL tables are identical to the ones the
JSON/XML importers produce via :class:`OCELWriter`.

The format stores one table per object/event type (``object_<suffix>`` /
``event_<suffix>``), whose real type name and table suffix are related through
the ``object_map_type`` / ``event_map_type`` tables.

Real-world files vary, so the importer is deliberately defensive:

* **Column names differ by exporter.** The timestamp is ``ocel_time`` (standard)
  or ``ocel:timestamp`` (pm4py); the change marker is ``ocel_changed_field`` or
  ``ocel:field``. Meta columns are matched by name, and everything else in a type
  table is treated as an attribute.
* **The initial-vs-change split is derived from timestamps, not the change
  marker.** An attribute's earliest value is its initial value (-> ``objects``)
  and every later value is a change (-> ``object_changes``). This matches
  OCELWriter and works whether a file stores an explicit initial row (pm4py) or
  only per-field change rows. A row with *no* time is an initial snapshot and so
  counts as earliest of all -- which SQL does not believe by default, hence
  :func:`_order_expr`.
* **Objects without attributes** have an empty/absent type table, so the
  ``objects`` rows are sourced from the core ``object`` table.
* **Dirty data.** SQLite is dynamically typed, so a numeric column may hold stray
  text (e.g. the literal ``'null'``). Columns are attached as VARCHAR and
  recovered with ``TRY_CAST``, which turns unparseable values into NULL instead
  of failing the import.
"""

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
    drop_unchanged_columns,
    merge_columns,
)
from ocelescope.util.sql import ident, literal

# ---------------------------------------------------------------------------
# What the source SQLite file looks like (OCEL 2.0 SQLite format)
# ---------------------------------------------------------------------------
# There is NOT one big "events"/"objects" table. Instead the log is spread over
# many tables, one per event/object *type*:
#
#   event                 (ocel_id, ocel_type)            -- id -> type index
#   object                (ocel_id, ocel_type)            -- id -> type index
#   event_map_type        (ocel_type, ocel_type_map)      -- "place order" -> "PlaceOrder"
#   object_map_type       (ocel_type, ocel_type_map)      -- "order"       -> "Order"
#   event_<suffix>        (ocel_id, ocel_time,  <attr columns...>)     e.g. event_PlaceOrder
#   object_<suffix>       (ocel_id, ocel_time, ocel_changed_field, <attr columns...>)
#   event_object          (ocel_event_id, ocel_object_id, ocel_qualifier)   -- e2o
#   object_object         (ocel_source_id, ocel_target_id, ocel_qualifier)  -- o2o
#
# The real type name (e.g. "place order") can contain spaces, so it cannot be a
# table name directly; the *_map_type tables translate it to a table-safe suffix
# (e.g. "PlaceOrder"), giving the table name "event_PlaceOrder".
#
# Our job is to reshape those into the five flat DuckDB tables the rest of
# ocelescope reads (events, objects, object_changes, e2o, o2o) -- exactly what
# the JSON/XML importers build via OCELWriter.

#: SQLite declared column type -> Arrow type used for the generated columns.
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
    "DATE": pa.date64(),
}

#: Arrow attribute type -> DuckDB type to ``TRY_CAST`` the (VARCHAR) source into.
#: ``string`` is omitted because such columns are already text and need no cast.
_ARROW_TO_DUCKDB_CAST: dict[pa.DataType, str] = {
    pa.int64(): "BIGINT",
    pa.float64(): "DOUBLE",
    pa.bool_(): "BOOLEAN",
    pa.timestamp("us", tz="UTC"): "TIMESTAMPTZ",
}

#: Stands in for the time of a row that has none; see :func:`_order_expr`.
_EARLIEST = "'-infinity'::TIMESTAMPTZ"

#: Column names that carry the row timestamp (standard first, then pm4py).
_TIME_COLUMNS = ("ocel_time", "ocel:timestamp", "ocel:time")
#: Column names flagging which attribute a change row updates.
_CHANGED_FIELD_COLUMNS = ("ocel_changed_field", "ocel:field")
#: Non-attribute columns of a type table (everything else is an attribute).
#: ``@@cumcount`` is pm4py's internal split-helper, which its own SQLite exporter
#: writes into the type tables. It is read nowhere else, so it is dropped here
#: rather than leaking into the flat tables as a user attribute.
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
    # Declared types can carry a size, e.g. "VARCHAR(255)" -> keep only "VARCHAR".
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
        self.name = name  # physical table name, e.g. "event_PlaceOrder"
        self.ocel_type = ocel_type  # real type name, e.g. "place order"
        self.time_column: str | None = None
        self.attributes: SchemaDefinition = []

        # `columns` is a list of (column_name, sqlite_declared_type) pairs.
        for column, sqlite_type in columns:
            if column in _TIME_COLUMNS and self.time_column is None:
                self.time_column = column
            elif column not in _META_COLUMNS:
                # Not a known meta column -> it is a user-defined attribute.
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
            continue  # map references a table that isn't actually present
        # PRAGMA table_info rows are (cid, name, type, notnull, default, pk);
        # we keep column name (row[1]) and declared type (row[2]).
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

    # Aggregate each attribute to its earliest value; arg_min skips rows where the
    # value is NULL, so a change row that leaves an attribute alone doesn't claim
    # it, and a dirty leading value (e.g. the text 'null') is ignored in favour of
    # the first real one.
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
    """Fill ``object_changes`` with every *non-initial* attribute value.

    One INSERT per attribute: rows are ranked per object by time, and the
    earliest (rank 1, the initial value already stored in ``objects``) is
    dropped, leaving only genuine changes. Each change becomes a row carrying
    that single attribute, matching the shape OCELWriter produces.

    The rank is taken over :func:`_order_expr` so that an untimed snapshot row
    ranks first and drops out, while the stored timestamp stays the row's real
    one -- otherwise the snapshot would rank last, survive as a bogus change with
    no timestamp, and push the first real change into ``objects`` in its place.
    """
    if not table.time_column:  # no timestamps -> no notion of a change
        return
    stored_time = _timestamp_expr(table.time_column)
    order_key = _order_expr(table.time_column)
    for name, dtype in table.attributes:
        cast = _cast_expr(name, dtype)
        con.execute(
            f'INSERT INTO "{OBJECT_CHANGES_TABLE}" '
            f"({ident(OID_COL)}, {ident(TIMESTAMP_COL)}, {ident(name)}) "
            f'SELECT "ocel_id", {stored_time}, {cast} FROM src.{ident(table.name)} '
            f"WHERE {cast} IS NOT NULL "
            f'QUALIFY row_number() OVER (PARTITION BY "ocel_id" ORDER BY {order_key}) > 1'
        )


def import_ocel_sqlite(source: str | Path, target: DuckDBTarget) -> None:
    """Stream an OCEL 2.0 SQLite log into the DuckDB database at ``target``."""
    # --- Step 1: inspect the source schema (metadata only, no row data) --------
    # Open the SQLite file read-only just to learn which type tables exist and
    # what columns they have. We use Python's sqlite3 here because PRAGMA
    # table_info is the simplest way to read a column list.
    with sqlite3.connect(f"file:{Path(source)}?mode=ro", uri=True) as sqlite_con:
        cur = sqlite_con.cursor()
        present = _table_names(cur)
        event_tables = _discover(cur, "event", "event_map_type", present)
        object_tables = _discover(cur, "object", "object_map_type", present)

    # --- Step 2: work out the shared attribute columns -------------------------
    # Each type table declares only its own attributes; the flat `events` and
    # `objects` tables need the *union* across all types. merge_columns folds
    # duplicate names into one column (falling back to string on type clashes).
    event_columns = merge_columns([attr for table in event_tables for attr in table.attributes])
    object_columns = merge_columns([attr for table in object_tables for attr in table.attributes])

    with connect_target(target) as con:
        # Create the five empty output tables (the shared layout every importer
        # writes), then fill them below with bulk INSERTs.
        create_ocel_tables(con, object_columns, event_columns)

        # --- Step 3: attach the SQLite file so DuckDB can read it directly -----
        # After ATTACH, source tables are addressable as `src.<table>` and the
        # whole copy happens inside DuckDB (streamed), never through Python.
        # sqlite_all_varchar reads every column as text: SQLite is dynamically
        # typed, so a column declared REAL may still hold stray text (e.g. the
        # literal 'null'), which the scanner would otherwise refuse. We recover
        # the real types via TRY_CAST in the SELECTs below.
        con.execute("INSTALL sqlite; LOAD sqlite;")
        con.execute("SET GLOBAL sqlite_all_varchar=true")
        con.execute(f"ATTACH '{Path(source)}' AS src (TYPE sqlite, READ_ONLY)")

        try:
            # --- Step 4: events -> `events` table -----------------------------
            # One INSERT per event type. The activity is a constant (the real
            # type name from the map table), the timestamp is cast to UTC, and
            # each type's attributes flow into their matching shared columns.
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

            # --- Step 5: objects -> `objects` (initial) + `object_changes` ----
            # An object's initial attribute values become one `objects` row; every
            # later value of an attribute becomes an `object_changes` row. Both are
            # derived by "earliest value wins" rather than trusting an explicit
            # snapshot marker, so all format dialects behave the same (see helpers).
            for table in object_tables:
                _insert_objects(con, table)
                _insert_object_changes(con, table)
            # Which attributes actually changed is only known now they are all in.
            drop_unchanged_columns(con)

            # --- Step 6: relationship tables (straight column renames) --------
            # These live in single source tables, so one INSERT each. Guarded by an
            # existence check since a log may have no o2o (or no e2o) relations.
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

            # --- Step 7: quantity extension (optional) ------------------------
            # Copy the extension tables across the still-attached source, if present.
            import_quantities_sqlite(con, present)
        finally:
            # The connection may be the caller's and outlive this import, so leave
            # no `src` behind -- a later ATTACH on it would clash with the name.
            con.execute("DETACH src")
