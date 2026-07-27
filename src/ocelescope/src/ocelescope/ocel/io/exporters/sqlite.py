"""Exporter: DuckDB OCEL tables -> OCEL 2.0 SQLite log.

The inverse of :func:`import_ocel_sqlite`. The target file is attached to DuckDB
as ``out`` and every table is filled with a streamed ``CREATE TABLE ... AS
SELECT`` -- so, like the importer, the log never flows through Python. The flat
tables are fanned back out into the format's per-type layout:

* ``event`` / ``object``                 -- id -> type index tables
* ``event_map_type`` / ``object_map_type`` -- real type name -> table suffix
* ``event_<suffix>``                     -- one row per event, with its attributes
* ``object_<suffix>``                    -- one row per attribute value, straight
  from ``object_changes`` (the full history, initial values included)
* ``event_object`` / ``object_object``   -- e2o / o2o relationships
"""

from __future__ import annotations

import re
import sqlite3
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
from ocelescope.ocel.constants.quantity import SQL_ITEM_PROPERTIES
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.exporters.common import (
    event_type_attributes,
    object_type_attributes,
    sqlite_decl,
)
from ocelescope.ocel.io.exporters.quantities import (
    export_quantities_sqlite,
    item_properties_ddl,
)
from ocelescope.util.sql import ident

_Attributes = list[tuple[str, str]]


def _suffix_map(types: list[str]) -> dict[str, str]:
    used: set[str] = set()
    mapping: dict[str, str] = {}
    for type_name in types:
        base = re.sub(r"\W+", "", type_name).strip("_") or "type"
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


def _iso(expr: str) -> str:
    """Render a stored timestamp as ISO 8601 text, as the format expects.

    The column is zone-less but holds UTC, so the offset is appended rather than
    reformatted out of the cast. ``||`` keeps a NULL timestamp NULL, which
    ``concat`` would turn into a bare offset.
    """
    return f"replace(CAST({expr} AS VARCHAR), ' ', 'T') || '+00:00'"


#: One type table to write: ``(name, ddl columns, fill query, query params)``.
_TableSpec = tuple[str, list[tuple[str, str]], str, list]


def _create_tables(target: Path, specs: list[_TableSpec]) -> None:
    """Create the type tables through plain sqlite3, before DuckDB attaches the file.

    DuckDB's SQLite writer picks its own declared type when it creates a table, and
    it does not keep the ones :func:`_sqlite_decl` asks for: a ``TIMESTAMP`` column
    lands as ``VARCHAR`` and a ``BOOLEAN`` as an integer. Since the importer reads
    an attribute's type back off that declared name, a table DuckDB created cannot
    round-trip a ``time`` or ``boolean`` attribute -- and the ``BOOLEAN`` -> integer
    mapping makes inserting the text ``'true'`` fail outright.

    So the tables are created here, with the declarations we want, and DuckDB is
    left to do nothing but ``INSERT`` into them.
    """
    with sqlite3.connect(target) as con:
        for table, ddl_columns, _, _ in specs:
            column_ddl = ", ".join(f"{ident(name)} {decl}" for name, decl in ddl_columns)
            con.execute(f"CREATE TABLE {ident(table)} ({column_ddl})")


def _fill(con: duckdb.DuckDBPyConnection, spec: _TableSpec) -> None:
    """Fill an already-created ``out.<table>`` from its SELECT.

    Every value is stored as text (the SELECT casts to VARCHAR), matching how the
    importer reads OCEL SQLite files (``sqlite_all_varchar`` + ``TRY_CAST``). With
    ``sqlite_all_varchar`` set here too, DuckDB sees the attached columns as
    VARCHAR and the text goes in as-is rather than being cast to the column's type.
    """
    table, ddl_columns, select_sql, params = spec
    insert_columns = ", ".join(f'"{name}"' for name, _ in ddl_columns)
    con.execute(f'INSERT INTO out."{table}" ({insert_columns}) {select_sql}', params)


def _event_type_table(suffix: str, activity: str, attributes: _Attributes) -> _TableSpec:
    ddl = [("ocel_id", "TEXT"), ("ocel_time", "TIMESTAMP")]
    ddl += [(name, sqlite_decl(dtype)) for name, dtype in attributes]
    exprs = [f'CAST("{EID_COL}" AS VARCHAR)', _iso(f'"{TIMESTAMP_COL}"')]
    exprs += [f'CAST("{name}" AS VARCHAR)' for name, _ in attributes]
    return (
        f"event_{suffix}",
        ddl,
        f'SELECT {", ".join(exprs)} FROM events WHERE "{ACTIVITY_COL}" = ?',
        [activity],
    )


def _object_type_table(suffix: str, otype: str, attributes: _Attributes) -> _TableSpec:
    """Rebuild one ``object_<suffix>`` table straight from ``object_changes``.

    ``object_changes`` holds an object's full value history -- initial values
    included -- so each of its rows becomes one type-table row naming its field.
    No snapshot row is reconstructed from ``objects``: re-importing takes each
    attribute's earliest row back into ``objects``, so the split survives the
    round trip without one.

    ``attributes`` are the type's attributes, which are read off ``object_changes``
    in the first place, so each of them has a column there to read.
    """
    ddl = [("ocel_id", "TEXT"), ("ocel_time", "TIMESTAMP"), ("ocel_changed_field", "TEXT")]
    ddl += [(name, sqlite_decl(dtype)) for name, dtype in attributes]

    selects: list[str] = []
    params: list = []

    for changed, _ in attributes:
        values = [
            f'CAST(c."{name}" AS VARCHAR)' if name == changed else "CAST(NULL AS VARCHAR)"
            for name, _ in attributes
        ]
        change = [
            f'CAST(c."{OID_COL}" AS VARCHAR)',
            _iso(f'c."{TIMESTAMP_COL}"'),
            "CAST(? AS VARCHAR)",
            *values,
        ]
        selects.append(
            f"SELECT {', '.join(change)} FROM object_changes c "
            f'JOIN objects o ON c."{OID_COL}" = o."{OID_COL}" '
            f'WHERE o."{OTYPE_COL}" = ? AND c."{changed}" IS NOT NULL'
        )
        params.extend([changed, otype])

    return f"object_{suffix}", ddl, " UNION ALL ".join(selects), params


def export_ocel_sqlite(source: DuckDBTarget, target: str | Path) -> None:
    """Write the OCEL in the DuckDB at ``source`` to an OCEL 2.0 SQLite log at ``target``.

    Args:
        source: Path to a DuckDB database holding the flat OCEL tables, or an
            open connection to one (e.g. an :class:`ocelescope.OCEL`'s own). It
            must be writable -- see below.
        target: Output path for the SQLite log.
    """
    target = Path(target)
    if target.exists():
        target.unlink()

    with connect_target(source) as con:
        object_attributes = object_type_attributes(con)
        event_attributes = event_type_attributes(con)

        object_suffix = _suffix_map(sorted(object_attributes))
        event_suffix = _suffix_map(sorted(event_attributes))

        specs = [
            _event_type_table(suffix, activity, event_attributes[activity])
            for activity, suffix in event_suffix.items()
        ]
        specs += [
            _object_type_table(suffix, otype, object_attributes[otype])
            for otype, suffix in object_suffix.items()
        ]

        qddl = item_properties_ddl(con)
        if qddl:
            specs.append((SQL_ITEM_PROPERTIES, qddl, "", []))

        _create_tables(target, specs)

        specs = [s for s in specs if s[2]]

        con.execute("INSTALL sqlite; LOAD sqlite;")

        con.execute("SET GLOBAL sqlite_all_varchar=true")
        con.execute(f"ATTACH '{target}' AS out (TYPE sqlite)")
        try:
            con.execute(
                f"CREATE TABLE out.object AS "
                f'SELECT "{OID_COL}" AS ocel_id, "{OTYPE_COL}" AS ocel_type FROM objects'
            )
            con.execute(
                f"CREATE TABLE out.event AS "
                f'SELECT "{EID_COL}" AS ocel_id, "{ACTIVITY_COL}" AS ocel_type FROM events'
            )

            _create_map_table(con, "object_map_type", object_suffix)
            _create_map_table(con, "event_map_type", event_suffix)

            for spec in specs:
                _fill(con, spec)

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
