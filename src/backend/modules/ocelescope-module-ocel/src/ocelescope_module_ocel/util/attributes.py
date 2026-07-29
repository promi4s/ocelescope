"""Attribute summaries, computed entirely in DuckDB.

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
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.util.sql import ident

from ocelescope import OCEL
from ocelescope_module_ocel.models import AggregatedAttribute, TypedAttribute
from ocelescope_module_ocel.models.attributes import ValueType

EntityType = Literal["events", "objects"]

ENTITY_ID = "ocel:entity_id"
ENTITY_TYPE = "ocel:entity_type"

_DUCKDB_TO_VALUE_TYPE = {
    "BIGINT": ValueType.INT,
    "DOUBLE": ValueType.FLOAT,
    "BOOLEAN": ValueType.BOOL,
    "DATE": ValueType.DATE,
}


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
    condition = f"{ident(name)} IS NOT NULL"
    if duckdb_type.upper() == "VARCHAR":
        condition += f" AND {ident(name)} <> ''"
    return condition


def merged_event_table(
    ocel: OCEL,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """One row per event: entity_id (ocel:eid), entity_type (ocel:activity), + attrs.

    ``attribute_names`` = the attribute columns to include (``None`` = every event
    attribute). ``entity_names`` optionally restricts to those activities (``None`` =
    all; empty list = nothing).
    """
    if attribute_names is None:
        attribute_names = ocel.events.attribute_names

    params: list[object] = []
    columns = ", ".join(
        [
            f"{ident(EID_COL)} AS {ident(ENTITY_ID)}",
            f"{ident(ACTIVITY_COL)} AS {ident(ENTITY_TYPE)}",
            *(ident(name) for name in attribute_names),
        ]
    )
    where = _type_filter(ident(ACTIVITY_COL), entity_names, params)
    return ocel.sql(f"SELECT {columns} FROM events {where}", params)


def merged_object_table(
    ocel: OCEL,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """One row per object value: entity_id (ocel:oid), entity_type (ocel:type), + attrs.

    Read from object_changes alone: the importers write every value an attribute ever
    held there, initial ones included, so the objects table adds no value of its own and
    is only joined for the type. An oid recurs once per change. Columns match
    ``merged_event_table``.

    ``attribute_names`` = the attribute columns to include (``None`` = every object
    attribute). ``entity_names`` optionally restricts to those object types (``None`` =
    all; empty list = nothing).
    """
    if attribute_names is None:
        attribute_names = ocel.objects.attribute_names

    columns = set(ocel.objects.attribute_names)
    selected = ", ".join(
        [
            f"c.{ident(OID_COL)} AS {ident(ENTITY_ID)}",
            f"o.{ident(OTYPE_COL)} AS {ident(ENTITY_TYPE)}",
            *(f"c.{ident(name)}" for name in attribute_names if name in columns),
        ]
    )
    params: list[object] = []
    where = _type_filter(f"o.{ident(OTYPE_COL)}", entity_names, params)
    return ocel.sql(
        f"SELECT {selected} FROM object_changes c "
        f"JOIN objects o ON c.{ident(OID_COL)} = o.{ident(OID_COL)} {where}",
        params,
    )


def merged_table(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """Dispatch to ``merged_event_table`` / ``merged_object_table`` by entity kind."""
    merged = merged_event_table if entity_type == "events" else merged_object_table
    return merged(ocel, attribute_names, entity_names)


def attribute_names(
    ocel: OCEL,
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
    table = merged_table(ocel, entity_type, attribute_names, entity_names)
    types = dict(zip(table.columns, (str(t) for t in table.types)))
    names = [c for c in table.columns if c not in (ENTITY_ID, ENTITY_TYPE)]
    if not names:
        return []

    exprs: list[str] = []
    for name in names:
        present = _present(name, types[name])
        exprs.append(f"count(*) FILTER (WHERE {present})")
        if drop_constant:
            exprs.append(f"count(DISTINCT {ident(name)}) FILTER (WHERE {present})")
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
            f"min({ident(name)}) FILTER (WHERE {present})",
            f"max({ident(name)}) FILTER (WHERE {present})",
            f"count(DISTINCT {ident(name)}) FILTER (WHERE {present})",
            f"array_agg(DISTINCT {ident(ENTITY_TYPE)}) FILTER (WHERE {present})",
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
            f"min({ident(name)}) FILTER (WHERE {present})",
            f"max({ident(name)}) FILTER (WHERE {present})",
            f"count(DISTINCT {ident(name)}) FILTER (WHERE {present})",
        ]
    rows = table.aggregate(
        f"{ident(ENTITY_TYPE)}, {', '.join(exprs)}", group_expr=ident(ENTITY_TYPE)
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
