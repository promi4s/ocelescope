"""Attribute summaries, computed entirely in DuckDB.

Every summary reads one *long table*: ``(ocel:entity_type, name, value)``, one row per
attribute value present in the log -- a row per event attribute, a row per object
change. Both entity kinds reach that shape by unpivoting their wide storage, so a
summary is one ``GROUP BY`` over it however many attributes the log has:
``attribute_stats`` groups by name, or by name and entity type with ``per_type``.

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
from ocelescope.ocel.constants.misc import EPOCH_SQL
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
    AttributeStats,
    AttributeSummary,
    AttributeValueCount,
    AttributeValues,
    Bin,
    SharedAttribute,
)
from ocelescope_module_ocel.models.attributes import ValueType
from ocelescope_module_ocel.util.selectors import FirstValue, ValueSelector
from ocelescope_module_ocel.util.sql import absent, in_list

EntityType = Literal["events", "objects"]

ENTITY_TYPE = "ocel:entity_type"

AttributeRows = tuple[duckdb.DuckDBPyRelation, ValueType]

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


def attribute_types(ocel: OCEL, entity_type: EntityType) -> dict[str, ValueType]:
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
    names = list(attribute_types(ocel, entity_type))
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


def attribute_stats(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str] | None = None,
    entity_names: list[str] | None = None,
    per_type: bool = False,
) -> list[AttributeStats]:
    types = attribute_types(ocel, entity_type)
    numeric = [n for n, t in types.items() if t in (ValueType.INT, ValueType.FLOAT)]
    entity = ident(ENTITY_TYPE)
    group = f"name, {entity}" if per_type else "name"
    rows = (
        long_table(ocel, entity_type, attribute_names, entity_names)
        .query(
            "long",
            f"SELECT name, count(DISTINCT value), {_extremes(numeric)}, "
            f"list(DISTINCT {entity} ORDER BY {entity}) "
            f"FROM long GROUP BY {group} ORDER BY {group}",
        )
        .fetchall()
    )
    return [
        AttributeStats(
            name=name,
            type=types[name],
            min=_marshal(minimum, types[name]),
            max=_marshal(maximum, types[name]),
            distinct_values=int(distinct or 0),
            entity_types=entities,
        )
        for name, distinct, minimum, maximum, entities in rows
    ]


def shared_attributes(
    ocel: OCEL,
    entity_type: EntityType,
    entity_names: list[str] | None = None,
) -> list[SharedAttribute]:
    types = attribute_types(ocel, entity_type)
    rows = (
        long_table(ocel, entity_type, entity_names=entity_names)
        .query(
            "long",
            f"SELECT name, list(DISTINCT {ident(ENTITY_TYPE)} "
            f"ORDER BY {ident(ENTITY_TYPE)}) "
            "FROM long GROUP BY name ORDER BY name",
        )
        .fetchall()
    )
    return [
        SharedAttribute(name=name, type=types[name], entity_types=entities)
        for name, entities in rows
    ]


def attribute_values(
    ocel: OCEL,
    entity_type: EntityType,
    attribute: str,
    entity_names: list[str] | None = None,
    selector: ValueSelector | None = None,
) -> AttributeRows | None:
    value_type = attribute_types(ocel, entity_type).get(attribute)
    if value_type is None:
        return None

    if entity_type == "events":
        column = ident(attribute)
        types = (
            ""
            if entity_names is None
            else f"WHERE {in_list(ident(ACTIVITY_COL), entity_names)}"
        )
        rows = ocel.sql(
            f"SELECT CASE WHEN {absent(column)} THEN NULL ELSE {column} END AS value "
            f"FROM {ident(EVENTS_TABLE)} {types}"
        )
        return rows, value_type

    oid, otype, ts = ident(OID_COL), ident(OTYPE_COL), ident(TIMESTAMP_COL)
    column = f"c.{ident(attribute)}"
    selected = (selector or FirstValue()).aggregate(column, f"c.{ts}", "true")
    types = (
        "" if entity_names is None else f"WHERE {in_list(f'o.{otype}', entity_names)}"
    )
    rows = ocel.sql(
        f"SELECT CASE WHEN {absent('selected')} THEN NULL ELSE selected END AS value "
        f"FROM (SELECT {selected} AS selected FROM {ident(OBJECTS_TABLE)} o "
        f"LEFT JOIN {ident(OBJECT_CHANGES_TABLE)} c ON c.{oid} = o.{oid} "
        f"AND c.{ident(OBJECT_CHANGED_FIELD)} = {literal(attribute)} "
        f"{types} GROUP BY o.{oid})"
    )
    return rows, value_type


def is_dynamic(
    ocel: OCEL, attribute: str, object_types: list[str] | None = None
) -> bool:
    oid, otype, ts = ident(OID_COL), ident(OTYPE_COL), ident(TIMESTAMP_COL)
    column = f"c.{ident(attribute)}"
    types = "" if object_types is None else f"AND {in_list(f'o.{otype}', object_types)}"
    (dynamic,) = ocel.sql(
        f"SELECT coalesce(bool_or(c.{ts} <> {EPOCH_SQL} AND NOT {absent(column)}), false) "
        f"FROM {ident(OBJECT_CHANGES_TABLE)} c "
        f"JOIN {ident(OBJECTS_TABLE)} o ON o.{oid} = c.{oid} "
        f"WHERE c.{ident(OBJECT_CHANGED_FIELD)} = {literal(attribute)} {types}"
    ).fetchone() or (False,)
    return bool(dynamic)


def _extreme(value: object) -> str | float | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (int, float)):
        return float(value)
    return str(value)


def attribute_summary(
    rows: duckdb.DuckDBPyRelation, value_type: ValueType, dynamic: bool = False
) -> AttributeSummary:
    count, missing, distinct, low, high = rows.query(
        "attribute",
        "SELECT count(value), count(*) - count(value), count(DISTINCT value), "
        "min(value), max(value) FROM attribute",
    ).fetchone() or (0, 0, 0, None, None)
    return AttributeSummary(
        type=value_type,
        count=count,
        missing=missing,
        distinct_values=distinct,
        min=_extreme(low),
        max=_extreme(high),
        dynamic=dynamic,
    )


def attribute_bins(
    rows: duckdb.DuckDBPyRelation, value_type: ValueType, count: int
) -> list[Bin]:
    if value_type not in ("int", "float", "date"):
        return []
    x = "epoch(value)" if value_type == "date" else "value::DOUBLE"
    low, high = rows.query(
        "attribute", f"SELECT min({x}), max({x}) FROM attribute"
    ).fetchone() or (None, None)
    if low is None or high is None:
        return []

    span = high - low
    if value_type == "int":
        width = float(max(1, math.ceil((span + 1) / count)))
        n = int(span // width) + 1
    else:
        n = count if span > 0 else 1
        width = span / n if span > 0 else 1.0

    counts = dict(
        rows.query(
            "attribute",
            f"SELECT least(floor(({x} - {low!r}) / {width!r})::BIGINT, {n - 1}) AS b, "
            f"count(*) FROM attribute WHERE value IS NOT NULL GROUP BY b",
        ).fetchall()
    )

    def bound(value: float) -> float | str:
        if value_type == "date":
            return datetime.fromtimestamp(value, UTC).replace(tzinfo=None).isoformat()
        return value

    return [
        Bin(
            start=bound(low + i * width),
            end=bound(high if i == n - 1 else low + (i + 1) * width),
            count=int(counts.get(i, 0)),
        )
        for i in range(n)
    ]


def attribute_counts(
    rows: duckdb.DuckDBPyRelation,
    regex: str | None = None,
    search: str | None = None,
    listed: list[str] | None = None,
    top: int = 200,
) -> AttributeValues:
    conditions = ["value IS NOT NULL"]
    if regex is not None:
        conditions.append(f"regexp_matches(value, {literal(regex)})")
    if search:
        conditions.append(f"contains(lower(value), lower({literal(search)}))")
    if listed is not None:
        conditions.append(
            f"value IN ({', '.join(literal(value) for value in listed) or 'NULL'})"
        )
    matched = rows.query(
        "attribute",
        f"SELECT value FROM (SELECT value::VARCHAR AS value FROM attribute) "
        f"WHERE {' AND '.join(conditions)}",
    )
    count, distinct = matched.query(
        "matched", "SELECT count(*), count(DISTINCT value) FROM matched"
    ).fetchone() or (0, 0)
    frequent = matched.query(
        "matched",
        "SELECT value, count(*) AS n FROM matched GROUP BY value "
        f"ORDER BY n DESC, value LIMIT {int(top)}",
    ).fetchall()
    return AttributeValues(
        count=count,
        distinct_values=distinct,
        values=[AttributeValueCount(value=value, count=n) for value, n in frequent],
    )
