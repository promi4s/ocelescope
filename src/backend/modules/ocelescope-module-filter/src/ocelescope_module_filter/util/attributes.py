from __future__ import annotations

import math
from datetime import UTC, datetime

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
from ocelescope_module_ocel.models.attributes import ValueType
from ocelescope_module_ocel.util.attributes import EntityType, attribute_types

from ocelescope import OCEL
from ocelescope_module_filter.filters.attribute.selectors import (
    FirstValue,
    ValueSelector,
)
from ocelescope_module_filter.filters.attribute.sql import absent, in_list
from ocelescope_module_filter.models import (
    AttributeBin,
    AttributeSummary,
    AttributeValueCount,
    AttributeValues,
)


def attribute_values(
    ocel: OCEL,
    entity_type: EntityType,
    attribute: str,
    entity_names: list[str] | None = None,
    selector: ValueSelector | None = None,
) -> tuple[DuckDBPyRelation, ValueType] | None:
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
    rows: DuckDBPyRelation, value_type: ValueType, dynamic: bool = False
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
    rows: DuckDBPyRelation, value_type: ValueType, count: int
) -> list[AttributeBin]:
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
        AttributeBin(
            start=bound(low + i * width),
            end=bound(high if i == n - 1 else low + (i + 1) * width),
            count=int(counts.get(i, 0)),
        )
        for i in range(n)
    ]


def attribute_counts(
    rows: DuckDBPyRelation,
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
