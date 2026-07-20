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
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.exporters.common import (
    INITIAL_ATTR_TIME,
    attribute_columns,
    changing_attributes,
    event_attribute_presence,
    object_attribute_presence,
)
from ocelescope.ocel.io.exporters.quantities import export_quantities_sqlite
from ocelescope.util.sql import ident

_OBJECT_META = (OID_COL, OTYPE_COL)
_EVENT_META = (EID_COL, ACTIVITY_COL, TIMESTAMP_COL)


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


def _ordered_present(ordered_attributes: list[tuple[str, str]], present: set[str]) -> list[str]:
    """The attribute names present for a type, in the flat table's column order."""
    return [name for name, _ in ordered_attributes if name in present]


def _iso(expr: str) -> str:
    """Render a ``TIMESTAMPTZ`` expression as ISO 8601 text, as the format expects."""
    return f"replace(replace(CAST({expr} AS VARCHAR), ' ', 'T'), '+00', '+00:00')"


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


def _event_type_table(
    suffix: str,
    activity: str,
    attrs: list[str],
    attr_type: dict[str, str],
) -> _TableSpec:
    ddl = [("ocel_id", "TEXT"), ("ocel_time", "TIMESTAMP")]
    ddl += [(name, _sqlite_decl(attr_type[name])) for name in attrs]
    exprs = [f'CAST("{EID_COL}" AS VARCHAR)', _iso(f'"{TIMESTAMP_COL}"')]
    exprs += [f'CAST("{name}" AS VARCHAR)' for name in attrs]
    return (
        f"event_{suffix}",
        ddl,
        f'SELECT {", ".join(exprs)} FROM events WHERE "{ACTIVITY_COL}" = ?',
        [activity],
    )


def _object_type_table(
    suffix: str,
    otype: str,
    attrs: list[str],
    attr_type: dict[str, str],
    changing: list[str],
) -> _TableSpec:
    """Rebuild one ``object_<suffix>`` table: the initial snapshot plus change rows.

    The snapshot row (``ocel_changed_field`` NULL) carries the initial values; each
    later value becomes its own row naming the changed field, matching the format
    and re-importing to the same ``objects`` / ``object_changes`` split.

    ``attrs`` are the type's attributes, which the snapshot reads off ``objects``;
    ``changing`` is the subset ``object_changes`` actually holds, since an
    attribute that never changes has no column there to read.
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

    for changed in changing:
        values = [
            f'CAST(c."{name}" AS VARCHAR)' if name == changed else "CAST(NULL AS VARCHAR)"
            for name in attrs
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
        object_presence = object_attribute_presence(con)
        event_presence = event_attribute_presence(con)
        object_attrs = attribute_columns(con, "objects", _OBJECT_META)
        event_attrs = attribute_columns(con, "events", _EVENT_META)

        object_suffix = _suffix_map(sorted(object_presence))
        event_suffix = _suffix_map(sorted(event_presence))
        event_attr_type = dict(event_attrs)
        object_attr_type = dict(object_attrs)

        specs = [
            _event_type_table(
                suffix,
                activity,
                _ordered_present(event_attrs, event_presence[activity]),
                event_attr_type,
            )
            for activity, suffix in event_suffix.items()
        ]
        changing = set(changing_attributes(con))
        for otype, suffix in object_suffix.items():
            present = _ordered_present(object_attrs, object_presence[otype])
            specs.append(
                _object_type_table(
                    suffix,
                    otype,
                    present,
                    object_attr_type,
                    [name for name in present if name in changing],
                )
            )
        _create_tables(target, specs)

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
