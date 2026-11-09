from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Literal

from duckdb import DuckDBPyRelation
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
from ocelescope_module_ocel.util.attributes import (
    ENTITY_TYPE,
    EntityType,
    entity_values,
    long_table,
)
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope_module_filter.filters.attribute.selectors import (
    FirstValue,
    ValueSelector,
)

ValueType = Literal["string", "bool", "int", "float", "date"]

_VALUE_TYPES: dict[str, ValueType] = {
    "BIGINT": "int",
    "DOUBLE": "float",
    "BOOLEAN": "bool",
    "DATE": "date",
}


class SharedAttribute(BaseModel):
    name: str
    type: ValueType
    entity_types: list[str]


class AttributeBin(BaseModel):
    start: float | str
    end: float | str
    count: int


class AttributeValueCount(BaseModel):
    value: str
    count: int


class AttributeValues(BaseModel):
    count: int
    distinct_values: int
    values: list[AttributeValueCount]


class AttributeSummary(BaseModel):
    type: ValueType
    count: int
    missing: int
    distinct_values: int
    min: str | float | None
    max: str | float | None
    dynamic: bool = False


def _column_types(ocel: OCEL, entity_type: EntityType) -> dict[str, ValueType]:
    table = EVENTS_TABLE if entity_type == "events" else OBJECT_CHANGES_TABLE
    return {
        name: "date"
        if dtype.upper().startswith("TIMESTAMP")
        else _VALUE_TYPES.get(dtype.upper(), "string")
        for name, dtype, *_ in ocel.con.execute(f"DESCRIBE {ident(table)}").fetchall()
    }


def shared_attributes(
    ocel: OCEL,
    entity_type: EntityType,
    entity_names: list[str] | None = None,
) -> list[SharedAttribute]:
    types = _column_types(ocel, entity_type)
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


def _object_values(
    ocel: OCEL,
    attribute: str,
    selector: ValueSelector,
    entity_names: list[str] | None,
) -> DuckDBPyRelation:
    oid, otype = ident(OID_COL), ident(OTYPE_COL)
    field = ident(OBJECT_CHANGED_FIELD)
    rows = f"{field} = {literal(attribute)}"
    selected = selector.aggregate(ident(attribute), ident(TIMESTAMP_COL), rows)

    types = ""
    params: list[object] = []
    if entity_names is not None:
        params.extend(entity_names)
        listed = ", ".join("?" for _ in entity_names)
        types = f"AND o.{otype} IN ({listed})" if entity_names else "AND false"

    return ocel.sql(
        f"SELECT o.{otype} AS {ident(ENTITY_TYPE)}, selected.value "
        f"FROM (SELECT {oid}, ({selected})::VARCHAR AS value "
        f"FROM {ident(OBJECT_CHANGES_TABLE)} WHERE {rows} GROUP BY {oid}) selected "
        f"JOIN {ident(OBJECTS_TABLE)} o USING ({oid}) "
        f"WHERE selected.value <> '' {types}",
        params,
    )


def _extreme(value: object) -> str | float | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (int, float)):
        return float(value)
    return str(value)


def _summary(
    ocel: OCEL,
    present: DuckDBPyRelation,
    carrying: DuckDBPyRelation,
    value_type: ValueType,
    table: str,
    type_column: str,
    dynamic: bool = False,
) -> AttributeSummary:
    compared = {
        "int": "try_cast(value AS DOUBLE)",
        "float": "try_cast(value AS DOUBLE)",
        "date": "try_cast(value AS TIMESTAMP)",
    }.get(value_type, "value")
    count, distinct, low, high = present.query(
        "present",
        f"SELECT count(*), count(DISTINCT value), min({compared}), max({compared}) "
        "FROM present",
    ).fetchone() or (0, 0, None, None)
    types = [
        entity
        for (entity,) in carrying.query(
            "carrying", f"SELECT DISTINCT {ident(ENTITY_TYPE)} FROM carrying"
        ).fetchall()
    ]

    total = 0
    if types:
        listed = ", ".join("?" for _ in types)
        (total,) = ocel.con.execute(
            f"SELECT count(*) FROM {ident(table)} "
            f"WHERE {ident(type_column)} IN ({listed})",
            types,
        ).fetchone() or (0,)

    return AttributeSummary(
        type=value_type,
        count=count,
        missing=total - count,
        distinct_values=distinct,
        min=_extreme(low),
        max=_extreme(high),
        dynamic=dynamic,
    )


def event_attribute_summary(
    ocel: OCEL,
    attribute: str,
    activities: list[str] | None = None,
) -> AttributeSummary | None:
    value_type = _column_types(ocel, "events").get(attribute)
    if value_type is None:
        return None
    present = entity_values(ocel, "events", attribute, activities)
    return _summary(ocel, present, present, value_type, EVENTS_TABLE, ACTIVITY_COL)


def _is_dynamic(ocel: OCEL, attribute: str, object_types: list[str] | None) -> bool:
    oid, otype = ident(OID_COL), ident(OTYPE_COL)
    params: list[object] = [attribute]
    types = ""
    if object_types is not None:
        params.extend(object_types)
        listed = ", ".join("?" for _ in object_types)
        types = f"AND o.{otype} IN ({listed})" if object_types else "AND false"
    (dynamic,) = ocel.con.execute(
        f"SELECT coalesce(bool_or(c.{ident(TIMESTAMP_COL)} <> {EPOCH_SQL}), false) "
        f"FROM {ident(OBJECT_CHANGES_TABLE)} c "
        f"JOIN {ident(OBJECTS_TABLE)} o USING ({oid}) "
        f"WHERE c.{ident(OBJECT_CHANGED_FIELD)} = ? {types}",
        params,
    ).fetchone() or (False,)
    return bool(dynamic)


def object_attribute_summary(
    ocel: OCEL,
    attribute: str,
    object_types: list[str] | None = None,
    selector: ValueSelector | None = None,
) -> AttributeSummary | None:
    value_type = _column_types(ocel, "objects").get(attribute)
    if value_type is None:
        return None
    present = _object_values(ocel, attribute, selector or FirstValue(), object_types)
    carrying = _object_values(ocel, attribute, FirstValue(), object_types)
    return _summary(
        ocel,
        present,
        carrying,
        value_type,
        OBJECTS_TABLE,
        OTYPE_COL,
        _is_dynamic(ocel, attribute, object_types),
    )


def _bins(
    present: DuckDBPyRelation, value_type: ValueType, bins: int
) -> list[AttributeBin]:
    if value_type not in ("int", "float", "date"):
        return []
    x = (
        "epoch(try_cast(value AS TIMESTAMP))"
        if value_type == "date"
        else "try_cast(value AS DOUBLE)"
    )
    low, high = present.query(
        "present", f"SELECT min({x}), max({x}) FROM present"
    ).fetchone() or (None, None)
    if low is None or high is None:
        return []

    span = high - low
    if value_type == "int":
        width = float(max(1, math.ceil((span + 1) / bins)))
        n = int(span // width) + 1
    else:
        n = bins if span > 0 else 1
        width = span / n if span > 0 else 1.0

    counts = dict(
        present.query(
            "present",
            f"SELECT least(floor(({x} - {low!r}) / {width!r})::BIGINT, {n - 1}) AS b, "
            f"count(*) FROM present WHERE {x} IS NOT NULL GROUP BY b",
        ).fetchall()
    )

    def bound(value: float) -> float | str:
        if value_type == "date":
            return datetime.fromtimestamp(value, UTC).replace(tzinfo=None).isoformat()
        return value

    return [
        AttributeBin(
            start=bound(low + i * width),
            end=bound(high if i == n - 1 else low + (i + 1) * width),
            count=int(counts.get(i, 0)),
        )
        for i in range(n)
    ]


def _values(
    present: DuckDBPyRelation,
    regex: str | None,
    search: str | None,
    values: list[str] | None,
    top: int,
) -> AttributeValues:
    conditions = ["true"]
    if regex is not None:
        conditions.append(f"regexp_matches(value, {literal(regex)})")
    if search:
        conditions.append(f"contains(lower(value), lower({literal(search)}))")
    if values is not None:
        listed = ", ".join(literal(value) for value in values) or "NULL"
        conditions.append(f"value IN ({listed})")
    matched = present.query(
        "present", f"SELECT * FROM present WHERE {' AND '.join(conditions)}"
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


def event_attribute_bins(
    ocel: OCEL,
    attribute: str,
    activities: list[str] | None = None,
    bins: int = 40,
) -> list[AttributeBin]:
    value_type = _column_types(ocel, "events").get(attribute)
    if value_type is None:
        return []
    present = entity_values(ocel, "events", attribute, activities)
    return _bins(present, value_type, bins)


def object_attribute_bins(
    ocel: OCEL,
    attribute: str,
    object_types: list[str] | None = None,
    selector: ValueSelector | None = None,
    bins: int = 40,
) -> list[AttributeBin]:
    value_type = _column_types(ocel, "objects").get(attribute)
    if value_type is None:
        return []
    present = _object_values(ocel, attribute, selector or FirstValue(), object_types)
    return _bins(present, value_type, bins)


def event_attribute_values(
    ocel: OCEL,
    attribute: str,
    activities: list[str] | None = None,
    regex: str | None = None,
    search: str | None = None,
    values: list[str] | None = None,
    top: int = 200,
) -> AttributeValues:
    present = entity_values(ocel, "events", attribute, activities)
    return _values(present, regex, search, values, top)


def object_attribute_values(
    ocel: OCEL,
    attribute: str,
    object_types: list[str] | None = None,
    selector: ValueSelector | None = None,
    regex: str | None = None,
    search: str | None = None,
    values: list[str] | None = None,
    top: int = 200,
) -> AttributeValues:
    if attribute not in _column_types(ocel, "objects"):
        return AttributeValues(count=0, distinct_values=0, values=[])
    present = _object_values(ocel, attribute, selector or FirstValue(), object_types)
    return _values(present, regex, search, values, top)
