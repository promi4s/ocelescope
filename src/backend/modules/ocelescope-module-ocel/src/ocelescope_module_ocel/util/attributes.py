"""Attribute summaries, computed entirely in DuckDB.

Every summary reads one *long table*: ``(ocel:entity_type, name, value)``, one row per
attribute value present in the log -- a row per event attribute, a row per object
change. Both entity kinds reach that shape by unpivoting their wide storage, so a
summary is one ``GROUP BY`` over it however many attributes the log has:
``aggregate_attributes`` groups by name, ``typed_attributes`` by name and entity type.

The reported :class:`ValueType` is the attribute's stored DuckDB column type -- the
importer only ever assigns a small fixed set (see
``ocelescope.ocel.io.schema.ATTRIBUTE_TYPE_TO_DUCKDB``), so no value-based inference is
needed. Unpivoting has to render every value as text to fit them in one column, so the
types are read from the stored columns before that and the extremes are cast back after.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Literal

import duckdb
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import (
    EVENTS_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.util.sql import ident, literal

from ocelescope import OCEL
from ocelescope_module_ocel.models import (
    AggregatedAttribute,
    AttributeBin,
    AttributeDistribution,
    AttributeMatches,
    AttributeValueCount,
    TypedAttribute,
)
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
            f"FROM {ident(EVENTS_TABLE)} {_type_filter(ident(ACTIVITY_COL), entity_names, params)}"
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
            f"FROM {ident(OBJECT_CHANGES_TABLE)} c JOIN {ident(OBJECTS_TABLE)} o USING ({ident(OID_COL)}) "
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


def entity_values(
    ocel: OCEL,
    entity_type: EntityType,
    attribute: str,
    entity_names: list[str] | None = None,
) -> duckdb.DuckDBPyRelation:
    if entity_type == "events" or attribute not in _attribute_types(ocel, "objects"):
        return long_table(ocel, entity_type, [attribute], entity_names)

    params: list[object] = []
    oid = ident(OID_COL)
    return ocel.sql(
        f"SELECT o.{ident(OTYPE_COL)} AS {ident(ENTITY_TYPE)}, "
        f"{literal(attribute)} AS name, earliest.value "
        f"FROM (SELECT {oid}, arg_min({ident(attribute)}, {ident(TIMESTAMP_COL)})::VARCHAR AS value "
        f"FROM {ident(OBJECT_CHANGES_TABLE)} "
        f"WHERE {ident(OBJECT_CHANGED_FIELD)} = {literal(attribute)} GROUP BY {oid}) earliest "
        f"JOIN {ident(OBJECTS_TABLE)} o USING ({oid}) "
        f"{_type_filter(f'o.{ident(OTYPE_COL)}', entity_names, params) or 'WHERE true'} "
        f"AND earliest.value <> ''",
        params,
    )


def attribute_distribution(
    ocel: OCEL,
    entity_type: EntityType,
    attribute: str,
    entity_names: list[str] | None = None,
    bins: int = 50,
    top: int = 200,
) -> AttributeDistribution | None:
    value_type = _attribute_types(ocel, entity_type).get(attribute)
    if value_type is None:
        return None

    long = entity_values(ocel, entity_type, attribute, entity_names)
    count, distinct, first, last = long.query(
        "long",
        "SELECT count(*), count(DISTINCT value), min(value), max(value) FROM long",
    ).fetchone() or (0, 0, None, None)
    if not count:
        return None

    if value_type in (ValueType.INT, ValueType.FLOAT, ValueType.DATE):
        x = (
            "epoch(try_cast(value AS TIMESTAMP))"
            if value_type is ValueType.DATE
            else "try_cast(value AS DOUBLE)"
        )
        low, high = long.query(
            "long", f"SELECT min({x}), max({x}) FROM long"
        ).fetchone() or (None, None)
        if low is None or high is None:
            return None
        span = high - low
        if value_type is ValueType.INT:
            width = float(max(1, math.ceil((span + 1) / bins)))
            n = int(span // width) + 1
        else:
            n = bins if span > 0 else 1
            width = span / n if span > 0 else 1.0

        counts = dict(
            long.query(
                "long",
                f"SELECT least(floor(({x} - {low!r}) / {width!r})::BIGINT, {n - 1}) AS b, "
                f"count(*) FROM long WHERE {x} IS NOT NULL GROUP BY b",
            ).fetchall()
        )

        def bound(value: float) -> float | str:
            if value_type is ValueType.DATE:
                return (
                    datetime.fromtimestamp(value, UTC).replace(tzinfo=None).isoformat()
                )
            return value

        histogram = [
            AttributeBin(
                start=bound(low + i * width),
                end=bound(high if i == n - 1 else low + (i + 1) * width),
                count=int(counts.get(i, 0)),
            )
            for i in range(n)
        ]
        return AttributeDistribution(
            name=attribute,
            type=value_type,
            count=count,
            distinct_values=distinct,
            min=bound(low)
            if value_type is ValueType.DATE
            else _marshal(str(low), value_type),
            max=bound(high)
            if value_type is ValueType.DATE
            else _marshal(str(high), value_type),
            bins=histogram,
        )

    frequent = long.query(
        "long",
        f"SELECT value, count(*) AS n FROM long GROUP BY value ORDER BY n DESC, value LIMIT {int(top)}",
    ).fetchall()
    return AttributeDistribution(
        name=attribute,
        type=value_type,
        count=count,
        distinct_values=distinct,
        min=_marshal(first, value_type),
        max=_marshal(last, value_type),
        values=[AttributeValueCount(value=value, count=n) for value, n in frequent],
    )


def attribute_values(
    ocel: OCEL,
    entity_type: EntityType,
    attribute: str,
    entity_names: list[str] | None = None,
    regex: str | None = None,
    search: str | None = None,
    values: list[str] | None = None,
    top: int = 200,
) -> AttributeMatches:
    conditions = ["true"]
    if regex is not None:
        conditions.append(f"regexp_matches(value, {literal(regex)})")
    if search:
        conditions.append(f"contains(lower(value), lower({literal(search)}))")
    if values is not None:
        listed = ", ".join(literal(value) for value in values) or "NULL"
        conditions.append(f"value IN ({listed})")
    long = entity_values(ocel, entity_type, attribute, entity_names).query(
        "long", f"SELECT * FROM long WHERE {' AND '.join(conditions)}"
    )
    count, distinct = long.query(
        "matched", "SELECT count(*), count(DISTINCT value) FROM matched"
    ).fetchone() or (0, 0)
    frequent = long.query(
        "matched",
        f"SELECT value, count(*) AS n FROM matched GROUP BY value "
        f"ORDER BY n DESC, value LIMIT {int(top)}",
    ).fetchall()
    return AttributeMatches(
        count=count,
        distinct_values=distinct,
        values=[AttributeValueCount(value=value, count=n) for value, n in frequent],
    )
