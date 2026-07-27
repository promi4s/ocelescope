"""Shared helpers for the DuckDB -> OCEL exporters."""

from __future__ import annotations

from typing import Iterator

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
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.util.sql import ident, literal

_BATCH = 10_000

_EVENT_META = (EID_COL, ACTIVITY_COL, TIMESTAMP_COL)
_CHANGES_META = (OID_COL, TIMESTAMP_COL)

_PLACEHOLDER = "__ocel_no_attribute"

_CHANGES = "__ocel_changes"
_RELS = "__ocel_rels"


def _attribute_rows(table: str, meta: tuple[str, ...]) -> str:
    """A relation of ``(meta..., name, value)``: one row per set attribute cell."""
    meta_list = ", ".join(ident(name) for name in meta)
    return f"""(
        UNPIVOT (
            SELECT {meta_list},
                   NULL::VARCHAR AS {ident(_PLACEHOLDER)},
                   COLUMNS(* EXCLUDE ({meta_list}))::VARCHAR
            FROM {ident(table)}
        ) ON COLUMNS(* EXCLUDE ({meta_list}))
    )"""


_CHANGE_ROWS = _attribute_rows(OBJECT_CHANGES_TABLE, _CHANGES_META)
_EVENT_ROWS = _attribute_rows(EVENTS_TABLE, _EVENT_META)


def _column_types(table: str) -> str:
    """A relation of ``table``'s ``(column_name, data_type, column_index)``.

    ``column_index`` is what puts a type's attributes in the flat table's column
    order, which ``DESCRIBE`` cannot be asked for inside a query. The database and
    schema are pinned to the current ones because ``duckdb_columns()`` spans every
    attached database, and a second one holding a table of the same name would
    otherwise contribute its columns too.
    """
    return f"""(
        SELECT column_name, data_type, column_index
        FROM duckdb_columns()
        WHERE table_name = {literal(table)}
          AND database_name = current_database()
          AND schema_name = current_schema()
    )"""


_OBJECT_TYPE_ATTRIBUTES_SQL = f"""
    SELECT t.{ident(OTYPE_COL)}, def.column_name, def.data_type
    FROM (SELECT DISTINCT {ident(OTYPE_COL)} FROM {ident(OBJECTS_TABLE)}) t
    LEFT JOIN (
        SELECT DISTINCT o.{ident(OTYPE_COL)}, chg.name
        FROM {_CHANGE_ROWS} chg
        JOIN {ident(OBJECTS_TABLE)} o USING ({ident(OID_COL)})
    ) used ON used.{ident(OTYPE_COL)} = t.{ident(OTYPE_COL)}
    LEFT JOIN {_column_types(OBJECT_CHANGES_TABLE)} def ON def.column_name = used.name
    ORDER BY 1, def.column_index
"""

_EVENT_TYPE_ATTRIBUTES_SQL = f"""
    SELECT t.{ident(ACTIVITY_COL)}, def.column_name, def.data_type
    FROM (SELECT DISTINCT {ident(ACTIVITY_COL)} FROM {ident(EVENTS_TABLE)}) t
    LEFT JOIN (
        SELECT DISTINCT {ident(ACTIVITY_COL)}, name
        FROM {_EVENT_ROWS}
    ) used ON used.{ident(ACTIVITY_COL)} = t.{ident(ACTIVITY_COL)}
    LEFT JOIN {_column_types(EVENTS_TABLE)} def ON def.column_name = used.name
    ORDER BY 1, def.column_index
"""

_O2O_SQL = f"""
    SELECT {ident(O2O_SOURCE_ID)} AS oid,
           list(struct_pack("objectId" := {ident(O2O_TARGET_ID)}, qualifier := {ident(O2O_QUALIFIER)})) AS rels
    FROM {ident(O2O_TABLE)}
    GROUP BY 1
"""

_E2O_SQL = f"""
    SELECT {ident(EID_COL)} AS eid,
           list(struct_pack("objectId" := {ident(OID_COL)}, qualifier := {ident(E2O_QUALIFIER)})) AS rels
    FROM {ident(E2O_TABLE)}
    GROUP BY 1
"""


_EVENTS_SQL = f"""
    SELECT e.*, rel.rels AS {ident(_RELS)}
    FROM {ident(EVENTS_TABLE)} e
    LEFT JOIN ({_E2O_SQL}) rel ON rel.eid = e.{ident(EID_COL)}
"""

_OBJECTS_SQL = f"""
    SELECT o.*, chg.changes AS {ident(_CHANGES)}, rel.rels AS {ident(_RELS)}
    FROM {ident(OBJECTS_TABLE)} o
    LEFT JOIN (
        SELECT {ident(OID_COL)} AS oid,
               list(struct_pack(name := name, "time" := {ident(TIMESTAMP_COL)}, value := value)
                    ORDER BY {ident(TIMESTAMP_COL)}) AS changes
        FROM {_CHANGE_ROWS}
        GROUP BY 1
    ) chg ON chg.oid = o.{ident(OID_COL)}
    LEFT JOIN ({_O2O_SQL}) rel ON rel.oid = o.{ident(OID_COL)}
"""


def table_exists(con: duckdb.DuckDBPyConnection, name: str) -> bool:
    """Whether a table called ``name`` exists on the connection."""
    return (
        con.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_name = ?", [name]
        ).fetchone()
        is not None
    )


def _columns(con: duckdb.DuckDBPyConnection, table: str) -> list[tuple[str, str]]:
    """The ``(name, duckdb_type)`` pairs of ``table`` in declaration order."""
    return [(row[0], row[1]) for row in con.execute(f"DESCRIBE {ident(table)}").fetchall()]


def attribute_columns(
    con: duckdb.DuckDBPyConnection, table: str, meta: tuple[str, ...]
) -> list[tuple[str, str]]:
    """The non-meta (i.e. user attribute) columns of ``table`` with their types."""
    return [(name, dtype) for name, dtype in _columns(con, table) if name not in meta]


def duckdb_type_to_ocel(duckdb_type: str) -> str:
    """Map a DuckDB column type back to an OCEL 2.0 attribute type string.

    The inverse of :data:`ATTRIBUTE_TYPE_TO_ARROW`; unknown types fall back to
    ``string`` (the universal supertype the importer also uses on clashes).
    """
    t = duckdb_type.upper()
    if "BOOL" in t:
        return "boolean"
    if "TIMESTAMP" in t or "DATE" in t or t == "TIME":
        return "time"
    if "INT" in t:  # TINYINT/SMALLINT/INTEGER/BIGINT/HUGEINT/UINTEGER...
        return "integer"
    if any(kind in t for kind in ("DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC")):
        return "float"
    return "string"


def _type_attributes(con: duckdb.DuckDBPyConnection, sql: str) -> dict[str, list[tuple[str, str]]]:
    """Group ``(type, attribute, DuckDB type)`` rows into ``{type: [(attribute, type)]}``.

    Types come out sorted and each one's attributes in the flat table's column order,
    both from the query's ``ORDER BY``. A type that uses no attribute arrives as a row
    with none and maps to an empty list rather than vanishing -- the exporters drive
    their type tables (and the type map) off these keys.
    """
    attributes: dict[str, list[tuple[str, str]]] = {}
    for type_name, name, dtype in con.execute(sql).fetchall():
        entries = attributes.setdefault(type_name, [])
        if name is not None:
            entries.append((name, dtype))
    return attributes


def object_type_attributes(con: duckdb.DuckDBPyConnection) -> dict[str, list[tuple[str, str]]]:
    """Each object type's attributes, in column order, with their DuckDB types.

    ``object_changes`` holds the full value history, so it alone answers which
    attributes a type uses -- and it is also where the values themselves are read
    from, so an attribute can never be declared off a column the values don't have.
    """
    return _type_attributes(con, _OBJECT_TYPE_ATTRIBUTES_SQL)


def event_type_attributes(con: duckdb.DuckDBPyConnection) -> dict[str, list[tuple[str, str]]]:
    """Each event type's (activity's) attributes, in column order, with their DuckDB types."""
    return _type_attributes(con, _EVENT_TYPE_ATTRIBUTES_SQL)


def _declarations(type_attributes: dict[str, list[tuple[str, str]]]) -> list[dict]:
    """Turn per-type attributes into OCEL type declarations, mapping the types over."""
    return [
        {
            "name": type_name,
            "attributes": [
                {"name": name, "type": duckdb_type_to_ocel(dtype)} for name, dtype in attributes
            ],
        }
        for type_name, attributes in type_attributes.items()
    ]


def object_types(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """OCEL object-type declarations reconstructed from the flat tables."""
    return _declarations(object_type_attributes(con))


def event_types(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """OCEL event-type declarations reconstructed from the flat tables."""
    return _declarations(event_type_attributes(con))


def iter_objects(con: duckdb.DuckDBPyConnection) -> Iterator[dict]:
    """Stream objects shaped like the importer input (id/type/attributes/relationships).

    DuckDB does the grouping and the joins; this only reshapes one row at a time,
    so peak memory stays bounded by the widest single object.
    """
    cursor = con.cursor()
    cursor.execute(_OBJECTS_SQL)
    names = [description[0] for description in cursor.description]

    while batch := cursor.fetchmany(_BATCH):
        for row in batch:
            record = dict(zip(names, row))
            attributes = [
                {"name": change["name"], "value": change["value"], "time": change["time"]}
                for change in record[_CHANGES] or []
            ]
            relationships = [
                {"objectId": rel["objectId"], "qualifier": rel["qualifier"]}
                for rel in record[_RELS] or []
            ]
            yield {
                "id": record[OID_COL],
                "type": record[OTYPE_COL],
                "attributes": attributes,
                "relationships": relationships,
            }


def iter_events(con: duckdb.DuckDBPyConnection) -> Iterator[dict]:
    """Stream events shaped like the importer input (id/type/time/attributes/relationships).

    The attribute columns are whatever the query returned beyond the fixed ones, so
    the events table is never asked twice what it holds.
    """
    cursor = con.cursor()
    cursor.execute(_EVENTS_SQL)
    names = [description[0] for description in cursor.description]
    attr_cols = [name for name in names if name not in _EVENT_META and name != _RELS]

    while batch := cursor.fetchmany(_BATCH):
        for row in batch:
            record = dict(zip(names, row))
            attributes = [
                {"name": name, "value": record[name]}
                for name in attr_cols
                if record[name] is not None
            ]
            relationships = [
                {"objectId": rel["objectId"], "qualifier": rel["qualifier"]}
                for rel in record[_RELS] or []
            ]
            yield {
                "id": record[EID_COL],
                "type": record[ACTIVITY_COL],
                "time": record[TIMESTAMP_COL],
                "attributes": attributes,
                "relationships": relationships,
            }


def sqlite_decl(duckdb_type: str) -> str:
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
