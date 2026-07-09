"""Exporter: DuckDB OCEL tables -> OCEL 2.0 SQLite log.

The inverse of :func:`import_ocel_sqlite`. The target file is attached to DuckDB
as ``out`` and every table is filled with a streamed ``CREATE TABLE ... AS
SELECT`` -- so, like the importer, the log never flows through Python. The flat
tables are fanned back out into the format's per-type layout:

* ``event`` / ``object``                 -- id -> type index tables
* ``event_map_type`` / ``object_map_type`` -- real type name -> table suffix
* ``event_<suffix>``                     -- one row per event, with its attributes
* ``object_<suffix>``                    -- initial snapshot + one row per change
* ``event_object`` / ``object_object``   -- e2o / o2o relationships

The ``objects`` table has no timestamp, so initial snapshot rows are stamped with
:data:`INITIAL_ATTR_TIME` (which re-imports as the initial value, since it sorts
before any real change).
"""

from __future__ import annotations

import re
from pathlib import Path

import duckdb

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
from ocelescope.ocel.io.export_common import (
    INITIAL_ATTR_TIME,
    attribute_columns,
    event_attribute_presence,
    object_attribute_presence,
)
from ocelescope.ocel.io.export_quantities import export_quantities_sqlite

_OBJECT_META = (OID_COL, OTYPE_COL)
_EVENT_META = (EID_COL, ACTIVITY_COL, TIMESTAMP_COL)


def _suffix_map(types: list[str]) -> dict[str, str]:
    """Assign each real type name a unique, table-safe suffix (e.g. ``place order`` -> ``place_order``)."""
    used: set[str] = set()
    mapping: dict[str, str] = {}
    for type_name in types:
        base = re.sub(r"\W+", "_", type_name).strip("_") or "type"
        candidate, counter = base, 1
        while candidate in used:
            counter += 1
            candidate = f"{base}_{counter}"
        used.add(candidate)
        mapping[type_name] = candidate
    return mapping


def _create_map_table(con: duckdb.DuckDBPyConnection, table: str, mapping: dict[str, str]) -> None:
    con.execute(f'CREATE TABLE out."{table}" (ocel_type VARCHAR, ocel_type_map VARCHAR)')
    if mapping:
        con.executemany(f'INSERT INTO out."{table}" VALUES (?, ?)', list(mapping.items()))


def _ordered_present(ordered_attributes: list[tuple[str, str]], present: set[str]) -> list[str]:
    """The attribute names present for a type, in the flat table's column order."""
    return [name for name, _ in ordered_attributes if name in present]


def _sqlite_decl(duckdb_type: str) -> str:
    """A SQLite column type the importer maps back to ``duckdb_type``'s arrow type.

    DuckDB's ``CREATE TABLE ... AS SELECT`` into SQLite only ever declares
    ``BIGINT``/``DOUBLE``/``VARCHAR``, which would collapse ``boolean`` -> integer
    and ``time`` -> string on re-import. So the type tables are created with
    explicit DDL and values stored as text; the importer recovers the real type
    from these declared names (see ``_SQLITE_TYPE_TO_ARROW``).
    """
    t = duckdb_type.upper()
    if "BOOL" in t:
        return "BOOLEAN"
    if "TIMESTAMP" in t or t == "TIME":
        return "TIMESTAMP"
    if "DATE" in t:
        return "DATE"
    if "INT" in t:
        return "BIGINT"
    if any(kind in t for kind in ("DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC")):
        return "DOUBLE"
    return "TEXT"


def _create_and_fill(
    con: duckdb.DuckDBPyConnection,
    table: str,
    ddl_columns: list[tuple[str, str]],
    select_sql: str,
    params: list,
) -> None:
    """Create ``out.<table>`` with explicit column types, then fill it from a SELECT.

    Every value is stored as text (the SELECT casts to VARCHAR), matching how the
    importer reads OCEL SQLite files (``sqlite_all_varchar`` + ``TRY_CAST``).
    """
    column_ddl = ", ".join(f'"{name}" {decl}' for name, decl in ddl_columns)
    con.execute(f'CREATE TABLE out."{table}" ({column_ddl})')
    insert_columns = ", ".join(f'"{name}"' for name, _ in ddl_columns)
    con.execute(f'INSERT INTO out."{table}" ({insert_columns}) {select_sql}', params)


def _create_event_type_table(
    con: duckdb.DuckDBPyConnection,
    suffix: str,
    activity: str,
    attrs: list[str],
    attr_type: dict[str, str],
) -> None:
    ddl = [("ocel_id", "TEXT"), ("ocel_time", "TIMESTAMP")]
    ddl += [(name, _sqlite_decl(attr_type[name])) for name in attrs]
    exprs = [f'CAST("{EID_COL}" AS VARCHAR)', f'CAST("{TIMESTAMP_COL}" AS VARCHAR)']
    exprs += [f'CAST("{name}" AS VARCHAR)' for name in attrs]
    _create_and_fill(
        con,
        f"event_{suffix}",
        ddl,
        f'SELECT {", ".join(exprs)} FROM events WHERE "{ACTIVITY_COL}" = ?',
        [activity],
    )


def _create_object_type_table(
    con: duckdb.DuckDBPyConnection,
    suffix: str,
    otype: str,
    attrs: list[str],
    attr_type: dict[str, str],
) -> None:
    """Rebuild one ``object_<suffix>`` table: the initial snapshot plus change rows.

    The snapshot row (``ocel_changed_field`` NULL) carries the initial values; each
    later value becomes its own row naming the changed field, matching the format
    and re-importing to the same ``objects`` / ``object_changes`` split.
    """
    ddl = [("ocel_id", "TEXT"), ("ocel_time", "TIMESTAMP"), ("ocel_changed_field", "TEXT")]
    ddl += [(name, _sqlite_decl(attr_type[name])) for name in attrs]

    initial = [
        f'CAST("{OID_COL}" AS VARCHAR)',
        "CAST(? AS VARCHAR)",
        "CAST(NULL AS VARCHAR)",
        *(f'CAST("{name}" AS VARCHAR)' for name in attrs),
    ]
    selects = [f'SELECT {", ".join(initial)} FROM objects WHERE "{OTYPE_COL}" = ?']
    params: list = [INITIAL_ATTR_TIME, otype]

    for changed in attrs:
        values = [
            f'CAST(c."{name}" AS VARCHAR)' if name == changed else "CAST(NULL AS VARCHAR)"
            for name in attrs
        ]
        change = [
            f'CAST(c."{OID_COL}" AS VARCHAR)',
            f'CAST(c."{TIMESTAMP_COL}" AS VARCHAR)',
            "CAST(? AS VARCHAR)",
            *values,
        ]
        selects.append(
            f"SELECT {', '.join(change)} FROM object_changes c "
            f'JOIN objects o ON c."{OID_COL}" = o."{OID_COL}" '
            f'WHERE o."{OTYPE_COL}" = ? AND c."{changed}" IS NOT NULL'
        )
        params.extend([changed, otype])

    _create_and_fill(con, f"object_{suffix}", ddl, " UNION ALL ".join(selects), params)


def export_ocel_sqlite(db_path: str | Path, target: str | Path) -> None:
    """Write the OCEL in the DuckDB at ``db_path`` to an OCEL 2.0 SQLite log at ``target``."""
    target = Path(target)
    if target.exists():
        target.unlink()

    # Not read-only: attaching a writable SQLite output needs a writable connection.
    with duckdb.connect(str(db_path)) as con:
        con.execute("SET TimeZone='UTC'")
        con.execute("INSTALL sqlite; LOAD sqlite;")
        con.execute(f"ATTACH '{target}' AS out (TYPE sqlite)")
        try:
            # id -> type index tables
            con.execute(
                f"CREATE TABLE out.object AS "
                f'SELECT "{OID_COL}" AS ocel_id, "{OTYPE_COL}" AS ocel_type FROM objects'
            )
            con.execute(
                f"CREATE TABLE out.event AS "
                f'SELECT "{EID_COL}" AS ocel_id, "{ACTIVITY_COL}" AS ocel_type FROM events'
            )

            object_presence = object_attribute_presence(con)
            event_presence = event_attribute_presence(con)
            object_attrs = attribute_columns(con, "objects", _OBJECT_META)
            event_attrs = attribute_columns(con, "events", _EVENT_META)

            object_suffix = _suffix_map(sorted(object_presence))
            event_suffix = _suffix_map(sorted(event_presence))
            _create_map_table(con, "object_map_type", object_suffix)
            _create_map_table(con, "event_map_type", event_suffix)

            for activity, suffix in event_suffix.items():
                _create_event_type_table(
                    con, suffix, activity, _ordered_present(event_attrs, event_presence[activity])
                )

            for otype, suffix in object_suffix.items():
                _create_object_type_table(
                    con, suffix, otype, _ordered_present(object_attrs, object_presence[otype])
                )

            # Relationship tables
            con.execute(
                f"CREATE TABLE out.object_object AS SELECT "
                f'"{O2O_SOURCE_ID}" AS ocel_source_id, "{O2O_TARGET_ID}" AS ocel_target_id, '
                f'"{O2O_QUALIFIER}" AS ocel_qualifier FROM o2o'
            )
            con.execute(
                f"CREATE TABLE out.event_object AS SELECT "
                f'"{EID_COL}" AS ocel_event_id, "{OID_COL}" AS ocel_object_id, '
                f'"{E2O_QUALIFIER}" AS ocel_qualifier FROM e2o'
            )

            export_quantities_sqlite(con)
        finally:
            con.execute("DETACH out")
