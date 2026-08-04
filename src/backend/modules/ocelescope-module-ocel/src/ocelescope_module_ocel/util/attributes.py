"""Attribute summaries, computed entirely in DuckDB.

Every summary reads one *long table*: ``(ocel:entity_type, name, value)``, one row per
attribute value present in the log -- a row per event attribute, a row per object
change. Both entity kinds reach that shape by unpivoting their wide storage, so a
summary is one ``GROUP BY`` over it however many attributes the log has:
``aggregate_attributes`` groups by name, ``typed_attributes`` by name and entity type.

The reported :class:`ValueType` is the attribute's stored DuckDB column type -- the
importer only ever assigns a small fixed set (see
``ocelescope.ocel.io.schema.ATTRIBUTE_TYPE_TO_ARROW``), so no value-based inference is
needed. Unpivoting has to render every value as text to fit them in one column, so the
types are read from the stored columns before that and the extremes are cast back after.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

import duckdb
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.constants.tables import (
    EVENTS_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.util.sql import ident, literal

from ocelescope import OCEL
from ocelescope_module_ocel.models import AggregatedAttribute, TypedAttribute
from ocelescope_module_ocel.models.attributes import ValueType

EntityType = Literal["events", "objects"]

ENTITY_TYPE = "ocel:entity_type"

_DUCKDB_TO_VALUE_TYPE = {
    "BIGINT": ValueType.INT,
    "DOUBLE": ValueType.FLOAT,
    "BOOLEAN": ValueType.BOOL,
    "DATE": ValueType.DATE,
}


def _value_type(duckdb_type: str) -> ValueType:
    """Map an attribute column's DuckDB type to the ValueType we report."""
    base = duckdb_type.upper()
    if base.startswith("TIMESTAMP"):
        return ValueType.DATE
    return _DUCKDB_TO_VALUE_TYPE.get(base, ValueType.STRING)


def _marshal(value: str | None, value_type: ValueType) -> str | int | float:
    """Read an extreme back out of the text the long table carries it as."""
    if value is None:
        return ""
    if value_type is ValueType.DATE:
        return datetime.fromisoformat(value).isoformat()
    if value_type is ValueType.INT:
        return int(float(value))
    if value_type is ValueType.FLOAT:
        return float(value)
    if value_type is ValueType.BOOL:
        return int(value == "true")
    return value


def _attribute_types(ocel: OCEL, entity_type: EntityType) -> dict[str, ValueType]:
    """Every attribute of ``entity_type``, with the ValueType its column reports.

    Attributes are the stored table's columns bar the OCEL ones -- an event table
    holds one per event attribute, a change table one per object attribute.
    """
    table = EVENTS_TABLE if entity_type == "events" else OBJECT_CHANGES_TABLE
    columns = ocel.con.execute(f"DESCRIBE {ident(table)}").fetchall()
    return {
        name: _value_type(dtype)
        for name, dtype, *_ in columns
        if not name.startswith("ocel:")
    }


def long_table(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    """``(ocel:entity_type, name, value)``: one row per attribute value present.

    UNPIVOT drops NULLs, so a row reaching the output is one the attribute actually
    holds a value in; the empty string is dropped alongside them, being how a text
    column spells absent. Object values are read from the change table, one row of
    which writes exactly one attribute -- ``ocel:field`` says which, and the rest of
    its columns belong to other attributes.

    ``attribute_names`` = the attributes to include (``None`` = all of them),
    ``entity_names`` the entity types (``None`` = all; empty list = nothing).
    """
    names = list(_attribute_types(ocel, entity_type))
    if attribute_names is not None:
        wanted = set(attribute_names)
        names = [name for name in names if name in wanted]
    if not names:
        return ocel.sql(
            f"SELECT NULL::VARCHAR AS {ident(ENTITY_TYPE)}, "
            f"NULL::VARCHAR AS name, NULL::VARCHAR AS value WHERE false"
        )

    params: list[object] = []
    columns = ", ".join(ident(name) for name in names)

    if entity_type == "events":
        values = ", ".join(f"{ident(name)}::VARCHAR AS {ident(name)}" for name in names)
        source = (
            f"SELECT {ident(ACTIVITY_COL)} AS {ident(ENTITY_TYPE)}, {values} "
            f"FROM {EVENTS_TABLE} {_type_filter(ident(ACTIVITY_COL), entity_names, params)}"
        )
        kept = "true"
    else:
        # the change table's own columns: an older objects table may repeat them
        values = ", ".join(
            f"c.{ident(name)}::VARCHAR AS {ident(name)}" for name in names
        )
        source = (
            f"SELECT o.{ident(OTYPE_COL)} AS {ident(ENTITY_TYPE)}, "
            f"c.{ident(OBJECT_CHANGED_FIELD)} AS field, {values} "
            f"FROM {OBJECT_CHANGES_TABLE} c JOIN {OBJECTS_TABLE} o USING ({ident(OID_COL)}) "
            f"{_type_filter(f'o.{ident(OTYPE_COL)}', entity_names, params)}"
        )
        kept = "field = name"

    return ocel.sql(
        f"SELECT {ident(ENTITY_TYPE)}, name, value "
        f"FROM (UNPIVOT ({source}) ON {columns}) "
        f"WHERE {kept} AND value <> ''",
        params,
    )


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


def _extremes(numeric: list[str]) -> str:
    """``min`` / ``max`` over the text values, ordered numerically where that is right.

    Text order is not value order for a number -- ``'10004' < '1023'`` -- so a numeric
    attribute is compared as a DOUBLE. Which attributes those are is decided by their
    stored type rather than by whether the values happen to parse, so a text attribute
    holding digits keeps its own order.
    """
    wanted = ", ".join(literal(name) for name in numeric) or "NULL"
    return ", ".join(
        f"CASE WHEN name IN ({wanted}) THEN {aggregate}(try_cast(value AS DOUBLE))::VARCHAR "
        f"ELSE {aggregate}(value) END"
        for aggregate in ("min", "max")
    )


def attribute_names(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
    drop_constant: bool = False,
) -> list[str]:
    """Sorted names of the attributes that carry a value in the scope.

    An attribute reaches the long table only where it has a value, so grouping it is
    the whole filter; ``drop_constant`` additionally drops attributes down to a single
    distinct value. This keeps in step with the summaries below, which omit the same
    attributes, so pages and totals stay consistent.
    """
    having = "HAVING count(DISTINCT value) > 1 " if drop_constant else ""
    rows = long_table(ocel, entity_type, attribute_names, entity_names).query(
        "long", f"SELECT name FROM long GROUP BY name {having}ORDER BY name"
    )
    return [name for (name,) in rows.fetchall()]


def aggregate_attributes(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> list[AggregatedAttribute]:
    """Summarize each attribute once, across all entity types.

    One grouped scan reports each attribute's min / max / distinct-count over its
    present values, plus the entity types it appears in. Attributes with no present
    values never reach the long table and are therefore omitted.
    """
    types = _attribute_types(ocel, entity_type)
    numeric = [n for n, t in types.items() if t in (ValueType.INT, ValueType.FLOAT)]

    rows = (
        long_table(ocel, entity_type, attribute_names, entity_names)
        .query(
            "long",
            f"SELECT name, count(DISTINCT value), {_extremes(numeric)}, "
            f"array_agg(DISTINCT {ident(ENTITY_TYPE)}) "
            f"FROM long GROUP BY name ORDER BY name",
        )
        .fetchall()
    )

    return [
        AggregatedAttribute(
            name=name,
            type=types[name],
            min=_marshal(minimum, types[name]),
            max=_marshal(maximum, types[name]),
            distinct_values=int(distinct or 0),
            entity_type_names=sorted(v for v in (entity_values or []) if v is not None),
        )
        for name, distinct, minimum, maximum, entity_values in rows
    ]


def typed_attributes(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
) -> list[TypedAttribute]:
    """Summarize each (attribute, entity type) pair.

    Like :func:`aggregate_attributes` but grouped by the entity type as well: one scan
    reports, for every activity / object type, each attribute's min / max /
    distinct-count over its present values within that type.
    """
    types = _attribute_types(ocel, entity_type)
    numeric = [n for n, t in types.items() if t in (ValueType.INT, ValueType.FLOAT)]
    group = ident(ENTITY_TYPE)

    rows = (
        long_table(ocel, entity_type, attribute_names, entity_names)
        .query(
            "long",
            f"SELECT name, {group}, count(DISTINCT value), {_extremes(numeric)} "
            f"FROM long GROUP BY name, {group} ORDER BY name, {group}",
        )
        .fetchall()
    )

    return [
        TypedAttribute(
            name=name,
            entity_type=entity,
            type=types[name],
            min=_marshal(minimum, types[name]),
            max=_marshal(maximum, types[name]),
            distinct_values=int(distinct or 0),
        )
        for name, entity, distinct, minimum, maximum in rows
    ]
