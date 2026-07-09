"""Shared helpers for the DuckDB -> OCEL exporters.

The exporters are the inverse of the importers: they read the flat DuckDB tables
and reconstruct an OCEL 2.0 log. Two reconstructions are non-trivial and live
here so the JSON and XML writers can share them:

* **Type declarations.** The flat ``objects``/``events`` tables hold the *union*
  of every type's attributes, so ``object_types`` / ``event_types`` recover which
  attributes actually occur per type (any non-null value in the snapshot or a
  change) and map each DuckDB column type back to an OCEL attribute type.
* **Per-entity records.** ``iter_objects`` / ``iter_events`` yield one dict per
  object/event -- shaped exactly like the importer input -- by letting DuckDB do
  the grouping (initial values + timestamped changes + relationships) and
  streaming the result a row at a time, so peak memory stays bounded by the log's
  widest single entity rather than the whole log.

The ``objects`` table carries no timestamp, so an object's initial attribute
values have no recoverable time; :data:`INITIAL_ATTR_TIME` is emitted in their
place. It sorts before any real timestamp, so a re-import still treats them as the
initial value.
"""

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

#: Placeholder time for initial (snapshot) attribute values; see module docstring.
INITIAL_ATTR_TIME = "1970-01-01T00:00:00+00:00"

#: Rows fetched per batch when streaming a table.
_BATCH = 10_000

_OBJECT_META = (OID_COL, OTYPE_COL)
_EVENT_META = (EID_COL, ACTIVITY_COL, TIMESTAMP_COL)


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
    return [(row[0], row[1]) for row in con.execute(f'DESCRIBE "{table}"').fetchall()]


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


def _presence(
    con: duckdb.DuckDBPyConnection, sql: str, attr_names: list[str]
) -> dict[str, set[str]]:
    """Run a ``GROUP BY type`` ``bool_or`` query into ``{type: {present attrs}}``.

    ``sql`` must select the type in the first column and, for each attribute in
    ``attr_names`` (same order), a boolean of whether it ever occurs non-null.
    """
    presence: dict[str, set[str]] = {}
    for row in con.execute(sql).fetchall():
        presence[row[0]] = {attr_names[i] for i, flag in enumerate(row[1:]) if flag}
    return presence


def object_attribute_presence(con: duckdb.DuckDBPyConnection) -> dict[str, set[str]]:
    """Which attributes each object type actually uses (in a snapshot *or* a change)."""
    names = [name for name, _ in attribute_columns(con, "objects", _OBJECT_META)]
    projection = "".join(f', bool_or("{name}" IS NOT NULL) AS "{name}"' for name in names)
    presence = _presence(con, f'SELECT "{OTYPE_COL}"{projection} FROM objects GROUP BY 1', names)

    # Attributes that only ever appear as a *change* still belong to the type.
    if names and table_exists(con, "object_changes"):
        change_projection = "".join(
            f', bool_or(c."{name}" IS NOT NULL) AS "{name}"' for name in names
        )
        change_presence = _presence(
            con,
            f'SELECT o."{OTYPE_COL}"{change_projection} FROM object_changes c '
            f'JOIN objects o ON c."{OID_COL}" = o."{OID_COL}" GROUP BY 1',
            names,
        )
        for type_name, present in change_presence.items():
            presence.setdefault(type_name, set()).update(present)
    return presence


def event_attribute_presence(con: duckdb.DuckDBPyConnection) -> dict[str, set[str]]:
    """Which attributes each event type (activity) actually uses."""
    names = [name for name, _ in attribute_columns(con, "events", _EVENT_META)]
    projection = "".join(f', bool_or("{name}" IS NOT NULL) AS "{name}"' for name in names)
    return _presence(con, f'SELECT "{ACTIVITY_COL}"{projection} FROM events GROUP BY 1', names)


def _type_declarations(
    ordered_attributes: list[tuple[str, str]], presence: dict[str, set[str]]
) -> list[dict]:
    """Turn ``{type: present attrs}`` into OCEL type declarations with attribute types."""
    ocel_type = {name: duckdb_type_to_ocel(dtype) for name, dtype in ordered_attributes}
    return [
        {
            "name": type_name,
            "attributes": [
                {"name": name, "type": ocel_type[name]}
                for name, _ in ordered_attributes
                if name in present
            ],
        }
        for type_name, present in sorted(presence.items())
    ]


def object_types(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """OCEL object-type declarations reconstructed from the flat tables."""
    attributes = attribute_columns(con, "objects", _OBJECT_META)
    return _type_declarations(attributes, object_attribute_presence(con))


def event_types(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """OCEL event-type declarations reconstructed from the flat tables."""
    attributes = attribute_columns(con, "events", _EVENT_META)
    return _type_declarations(attributes, event_attribute_presence(con))


def _objects_query(attr_cols: list[str]) -> str:
    """SQL yielding one row per object with its changes and relationships nested.

    Each attribute column is cast to text before being unpivoted into
    ``(name, time, value)`` change structs (``UNPIVOT`` needs one common type and
    drops NULLs), and object-to-object relationships are aggregated per source.
    DuckDB performs the grouping/joins; the caller streams the result.
    """
    joins = ""
    changes_select = "NULL"
    if attr_cols:
        casts = ", ".join(f'CAST("{name}" AS VARCHAR) AS "{name}"' for name in attr_cols)
        in_list = ", ".join(f'"{name}"' for name in attr_cols)
        joins += (
            f' LEFT JOIN (SELECT "{OID_COL}" AS oid, '
            f'list(struct_pack(name := field, "time" := ts, value := val) ORDER BY ts) AS changes '
            f'FROM (SELECT "{OID_COL}", "{TIMESTAMP_COL}" AS ts, {casts} FROM object_changes) '
            f'UNPIVOT (val FOR field IN ({in_list})) GROUP BY 1) chg ON chg.oid = o."{OID_COL}"'
        )
        changes_select = "chg.changes"

    joins += (
        f' LEFT JOIN (SELECT "{O2O_SOURCE_ID}" AS oid, '
        f'list(struct_pack("objectId" := "{O2O_TARGET_ID}", qualifier := "{O2O_QUALIFIER}")) AS rels '
        f'FROM o2o GROUP BY 1) rel ON rel.oid = o."{OID_COL}"'
    )

    return f'SELECT o.*, {changes_select} AS __changes, rel.rels AS __rels FROM objects o{joins}'


def iter_objects(con: duckdb.DuckDBPyConnection) -> Iterator[dict]:
    """Stream objects shaped like the importer input (id/type/attributes/relationships)."""
    attr_cols = [name for name, _ in attribute_columns(con, "objects", _OBJECT_META)]
    cursor = con.cursor()
    cursor.execute(_objects_query(attr_cols))
    names = [description[0] for description in cursor.description]

    while batch := cursor.fetchmany(_BATCH):
        for row in batch:
            record = dict(zip(names, row))
            attributes = [
                {"name": name, "value": record[name], "time": INITIAL_ATTR_TIME}
                for name in attr_cols
                if record[name] is not None
            ]
            for change in record["__changes"] or []:
                attributes.append(
                    {"name": change["name"], "value": change["value"], "time": change["time"]}
                )
            relationships = [
                {"objectId": rel["objectId"], "qualifier": rel["qualifier"]}
                for rel in record["__rels"] or []
            ]
            yield {
                "id": record[OID_COL],
                "type": record[OTYPE_COL],
                "attributes": attributes,
                "relationships": relationships,
            }


def _events_query() -> str:
    """SQL yielding one row per event with its object relationships nested."""
    return (
        f'SELECT e.*, rel.rels AS __rels FROM events e '
        f'LEFT JOIN (SELECT "{EID_COL}" AS eid, '
        f'list(struct_pack("objectId" := "{OID_COL}", qualifier := "{E2O_QUALIFIER}")) AS rels '
        f'FROM e2o GROUP BY 1) rel ON rel.eid = e."{EID_COL}"'
    )


def iter_events(con: duckdb.DuckDBPyConnection) -> Iterator[dict]:
    """Stream events shaped like the importer input (id/type/time/attributes/relationships)."""
    attr_cols = [name for name, _ in attribute_columns(con, "events", _EVENT_META)]
    cursor = con.cursor()
    cursor.execute(_events_query())
    names = [description[0] for description in cursor.description]

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
                for rel in record["__rels"] or []
            ]
            yield {
                "id": record[EID_COL],
                "type": record[ACTIVITY_COL],
                "time": record[TIMESTAMP_COL],
                "attributes": attributes,
                "relationships": relationships,
            }
