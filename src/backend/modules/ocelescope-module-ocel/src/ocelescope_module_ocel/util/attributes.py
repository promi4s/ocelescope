"""Attribute summaries over ``OCELDb``, computed entirely in DuckDB.

A *merged table* exposes ``ocel:entity_id`` / ``ocel:entity_type`` plus one column per
attribute -- one row per event (``merged_event_table``) or per object value incl.
object_changes (``merged_object_table``). Summaries are single aggregate scans over that
table: ``aggregate_attributes`` reports each attribute once (with the entity types it
appears in); ``typed_attributes`` reports each (attribute, entity type) pair.

The reported :class:`ValueType` is the attribute's stored DuckDB column type -- the
importer only ever assigns a small fixed set (see
``ocelescope.ocel.io.schema.ATTRIBUTE_TYPE_TO_ARROW``), so no value-based inference is
needed.
"""

from __future__ import annotations

from typing import Any, Literal

import duckdb
from ocelescope.ocel.constants import ValueType
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope_backend.app.internal.ocel.ocel_db import OCELDb

from ocelescope_module_ocel.models import AggregatedAttribute, TypedAttribute

EntityType = Literal["events", "objects"]

#: Structural output columns. ``ocel:``-prefixed so they never collide with a data
#: attribute (which can legitimately be named e.g. "entity_type").
ENTITY_ID = "ocel:entity_id"
ENTITY_TYPE = "ocel:entity_type"

#: The importer only gives attribute columns one of these DuckDB types (every integer ->
#: BIGINT, every float -> DOUBLE, time -> DATE, or TIMESTAMP from the sqlite path).
_DUCKDB_TO_VALUE_TYPE = {
    "BIGINT": ValueType.INT,
    "DOUBLE": ValueType.FLOAT,
    "BOOLEAN": ValueType.BOOL,
    "DATE": ValueType.DATE,
}


def _ident(name: str) -> str:
    """Safely double-quote a SQL identifier (column names contain ':' and spaces)."""
    return '"' + name.replace('"', '""') + '"'


def _type_filter(
    type_expr: str, entity_names: list[str] | None, params: list[object]
) -> str:
    """WHERE clause restricting ``type_expr`` to ``entity_names``, appending binds.

    ``None`` = no filter (all); an empty list = ``WHERE false`` (nothing).
    """
    if entity_names is None:
        return ""
    if not entity_names:
        return "WHERE false"
    params.extend(entity_names)
    placeholders = ", ".join(["?"] * len(entity_names))
    return f"WHERE {type_expr} IN ({placeholders})"


def _value_type(duckdb_type: str) -> ValueType:
    """Map an attribute column's DuckDB type to the ValueType we report."""
    base = duckdb_type.upper()
    if base.startswith("TIMESTAMP"):
        return ValueType.DATE
    return _DUCKDB_TO_VALUE_TYPE.get(base, ValueType.STRING)


def _marshal(value: Any, value_type: ValueType) -> Any:
    """Coerce a DuckDB min/max value into the model's ``str | int | float``."""
    if value_type is ValueType.DATE and hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _present(name: str, duckdb_type: str) -> str:
    """The ``WHERE`` condition for an attribute having a value (non-null, non-empty)."""
    condition = f"{_ident(name)} IS NOT NULL"
    if duckdb_type.upper() == "VARCHAR":
        condition += f" AND {_ident(name)} <> ''"
    return condition


def merged_event_table(
    ocel_db: OCELDb,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """One row per event: entity_id (ocel:eid), entity_type (ocel:activity), + attrs.

    ``attribute_names`` = the attribute columns to include (``None`` = every event
    attribute). ``entity_names`` optionally restricts to those activities (``None`` =
    all; empty list = nothing).
    """
    if attribute_names is None:
        meta = {EID_COL, ACTIVITY_COL, TIMESTAMP_COL}
        attribute_names = [c for c in ocel_db.events.columns if c not in meta]

    params: list[object] = []
    columns = ", ".join(
        [
            f"{_ident(EID_COL)} AS {_ident(ENTITY_ID)}",
            f"{_ident(ACTIVITY_COL)} AS {_ident(ENTITY_TYPE)}",
            *(_ident(name) for name in attribute_names),
        ]
    )
    where = _type_filter(_ident(ACTIVITY_COL), entity_names, params)
    return ocel_db.sql(f"SELECT {columns} FROM events {where}", params)


def merged_object_table(
    ocel_db: OCELDb,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """One row per object value: entity_id (ocel:oid), entity_type (ocel:type), + attrs.

    Unions the objects table (initial value) with object_changes (every subsequent
    value), so every value an attribute ever held is covered; an oid recurs once per
    change, typed by its object. Columns match ``merged_event_table``.

    ``attribute_names`` = the attribute columns to include (``None`` = every object
    attribute). ``entity_names`` optionally restricts to those object types (``None`` =
    all; empty list = nothing).
    """
    if attribute_names is None:
        meta = {OID_COL, OTYPE_COL}
        attribute_names = [c for c in ocel_db.objects.columns if c not in meta]

    # objects and object_changes share the attribute schema; UNION ALL BY NAME aligns
    # them and fills any attribute missing from one side with NULL there.
    change_cols = set(ocel_db.object_changes.columns)
    object_columns = ", ".join(
        [
            f"{_ident(OID_COL)} AS {_ident(ENTITY_ID)}",
            f"{_ident(OTYPE_COL)} AS {_ident(ENTITY_TYPE)}",
            *(
                _ident(name)
                for name in attribute_names
                if name in ocel_db.objects.columns
            ),
        ]
    )
    change_columns = ", ".join(
        [
            f"c.{_ident(OID_COL)} AS {_ident(ENTITY_ID)}",
            f"o.{_ident(OTYPE_COL)} AS {_ident(ENTITY_TYPE)}",
            *(f"c.{_ident(name)}" for name in attribute_names if name in change_cols),
        ]
    )
    params: list[object] = []
    objects_where = _type_filter(_ident(OTYPE_COL), entity_names, params)
    changes_where = _type_filter(f"o.{_ident(OTYPE_COL)}", entity_names, params)
    return ocel_db.sql(
        f"SELECT {object_columns} FROM objects {objects_where} "
        f"UNION ALL BY NAME "
        f"SELECT {change_columns} FROM object_changes c "
        f"JOIN objects o ON c.{_ident(OID_COL)} = o.{_ident(OID_COL)} {changes_where}",
        params,
    )


def merged_table(
    ocel_db: OCELDb,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """Dispatch to ``merged_event_table`` / ``merged_object_table`` by entity kind."""
    merged = merged_event_table if entity_type == "events" else merged_object_table
    return merged(ocel_db, attribute_names, entity_names)


def attribute_names(
    ocel_db: OCELDb,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
    drop_constant: bool = False,
) -> list[str]:
    """Sorted names of the attributes that carry a value in the scope.

    One scan keeps attributes with at least one present value (non-null, non-empty for
    text); ``drop_constant`` additionally drops attributes with a single distinct value.
    Present-filtering keeps this in step with ``aggregate_attributes`` (which omits
    value-less attributes), so pages and totals stay consistent.
    """
    table = merged_table(ocel_db, entity_type, attribute_names, entity_names)
    types = dict(zip(table.columns, (str(t) for t in table.types)))
    names = [c for c in table.columns if c not in (ENTITY_ID, ENTITY_TYPE)]
    if not names:
        return []

    exprs: list[str] = []
    for name in names:
        present = _present(name, types[name])
        exprs.append(f"count(*) FILTER (WHERE {present})")
        if drop_constant:
            exprs.append(f"count(DISTINCT {_ident(name)}) FILTER (WHERE {present})")
    row = table.aggregate(", ".join(exprs)).fetchone() or ()

    stride = 2 if drop_constant else 1
    kept = [
        name
        for i, name in enumerate(names)
        if row[i * stride] and not (drop_constant and (row[i * stride + 1] or 0) <= 1)
    ]
    return sorted(kept)


def aggregate_attributes(
    table: duckdb.DuckDBPyRelation,
) -> list[AggregatedAttribute]:
    """Summarize each attribute of a merged table once, across all entity types.

    A single aggregate scan reports each attribute's min / max / distinct-count over its
    present values plus the distinct entity types it appears in. The reported type is the
    DuckDB column type; attributes with no present values are omitted.
    """
    types = dict(zip(table.columns, (str(t) for t in table.types)))
    names = [c for c in table.columns if c not in (ENTITY_ID, ENTITY_TYPE)]
    if not names:
        return []

    exprs: list[str] = []
    for name in names:
        present = _present(name, types[name])
        exprs += [
            f"min({_ident(name)}) FILTER (WHERE {present})",
            f"max({_ident(name)}) FILTER (WHERE {present})",
            f"count(DISTINCT {_ident(name)}) FILTER (WHERE {present})",
            f"array_agg(DISTINCT {_ident(ENTITY_TYPE)}) FILTER (WHERE {present})",
        ]
    row = table.aggregate(", ".join(exprs)).fetchone()
    assert row is not None  # an aggregate without GROUP BY always yields one row

    attributes: list[AggregatedAttribute] = []
    for i, name in enumerate(names):
        minimum, maximum, distinct, entity_values = row[i * 4 : i * 4 + 4]
        if minimum is None:  # no present values -> omit
            continue
        value_type = _value_type(types[name])
        attributes.append(
            AggregatedAttribute(
                name=name,
                type=value_type,
                min=_marshal(minimum, value_type),
                max=_marshal(maximum, value_type),
                distinct_values=int(distinct or 0),
                entity_type_names=sorted(
                    v for v in (entity_values or []) if v is not None
                ),
            )
        )
    return attributes


def typed_attributes(table: duckdb.DuckDBPyRelation) -> list[TypedAttribute]:
    """Summarize each (attribute, entity type) pair of a merged table.

    Like ``aggregate_attributes`` but grouped by ``ocel:entity_type``: one scan reports,
    for every entity type, each attribute's min / max / distinct-count over its present
    values within that type. Pairs with no present values are omitted (no
    ``entity_type_names`` -- the group *is* the type, so ``array_agg`` isn't needed).
    """
    types = dict(zip(table.columns, (str(t) for t in table.types)))
    names = [c for c in table.columns if c not in (ENTITY_ID, ENTITY_TYPE)]
    if not names:
        return []

    exprs: list[str] = []
    for name in names:
        present = _present(name, types[name])
        exprs += [
            f"min({_ident(name)}) FILTER (WHERE {present})",
            f"max({_ident(name)}) FILTER (WHERE {present})",
            f"count(DISTINCT {_ident(name)}) FILTER (WHERE {present})",
        ]
    rows = table.aggregate(
        f"{_ident(ENTITY_TYPE)}, {', '.join(exprs)}", group_expr=_ident(ENTITY_TYPE)
    ).fetchall()

    attributes: list[TypedAttribute] = []
    for entity_type, *values in rows:
        for i, name in enumerate(names):
            minimum, maximum, distinct = values[i * 3 : i * 3 + 3]
            if minimum is None:  # attribute absent for this entity type -> omit
                continue
            value_type = _value_type(types[name])
            attributes.append(
                TypedAttribute(
                    name=name,
                    entity_type=entity_type,
                    type=value_type,
                    min=_marshal(minimum, value_type),
                    max=_marshal(maximum, value_type),
                    distinct_values=int(distinct or 0),
                )
            )
    return attributes
