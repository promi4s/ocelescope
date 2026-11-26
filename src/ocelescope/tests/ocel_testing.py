from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, NotRequired, Protocol, TypedDict

import duckdb
import polars as pl
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OBJECT_CHANGED_FIELD,
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
from ocelescope.ocel.core import OCEL
from ocelescope.ocel.view import Step, ViewOperation
from ocelescope.util.sql import ident, literal

Time = str | datetime

START = datetime(2024, 1, 1)


class AttributeValue(TypedDict):
    name: str
    value: Any
    time: NotRequired[Time]


class ObjectRow(TypedDict):
    id: str
    type: str
    attributes: NotRequired[dict[str, Any] | list[AttributeValue]]


class EventRow(TypedDict):
    id: str
    type: str
    time: NotRequired[Time]
    attributes: NotRequired[dict[str, Any]]


class RelationRow(TypedDict):
    source: str
    target: str
    qualifier: NotRequired[str]


def _timestamp(value: Time) -> datetime:
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(UTC).replace(tzinfo=None)


def _frame(rows: list[dict[str, Any]], schema: dict[str, Any]) -> pl.DataFrame:
    if not rows:
        return pl.DataFrame(schema=schema)
    return pl.DataFrame(rows, infer_schema_length=None, schema_overrides=schema)


def _unique(kind: str, ids: list[str]) -> set[str]:
    seen: set[str] = set()
    for id in ids:
        if id in seen:
            raise ValueError(f"duplicate {kind} id {id!r}")
        seen.add(id)
    return seen


def _check(kind: str, relations: Sequence[RelationRow], sources, targets) -> None:
    for relation in relations:
        if relation["source"] not in sources:
            raise ValueError(f"{kind} from unknown id {relation['source']!r}")
        if relation["target"] not in targets:
            raise ValueError(f"{kind} to unknown object {relation['target']!r}")


def _attribute_values(row: ObjectRow) -> list[AttributeValue]:
    attributes = row.get("attributes", {})
    if isinstance(attributes, dict):
        return [{"name": name, "value": value} for name, value in attributes.items()]
    return attributes


def build_log(
    objects: Sequence[ObjectRow] = (),
    events: Sequence[EventRow] = (),
    e2o: Sequence[RelationRow] = (),
    o2o: Sequence[RelationRow] = (),
) -> OCEL:
    object_ids = _unique("object", [row["id"] for row in objects])
    event_ids = _unique("event", [row["id"] for row in events])
    _check("e2o", e2o, event_ids, object_ids)
    _check("o2o", o2o, object_ids, object_ids)

    change_rows = [
        {
            OID_COL: row["id"],
            TIMESTAMP_COL: _timestamp(value["time"]) if "time" in value else None,
            OBJECT_CHANGED_FIELD: value["name"],
            value["name"]: value["value"],
        }
        for row in objects
        for value in _attribute_values(row)
    ]

    event_rows = [
        {
            EID_COL: row["id"],
            ACTIVITY_COL: row["type"],
            TIMESTAMP_COL: _timestamp(row["time"])
            if "time" in row
            else START + timedelta(hours=index),
            **row.get("attributes", {}),
        }
        for index, row in enumerate(events)
    ]

    log = OCEL.from_frames(
        events=_frame(
            event_rows,
            {
                EID_COL: pl.String,
                ACTIVITY_COL: pl.String,
                TIMESTAMP_COL: pl.Datetime("us"),
            },
        ),
        objects=_frame(
            [{OID_COL: row["id"], OTYPE_COL: row["type"]} for row in objects],
            {OID_COL: pl.String, OTYPE_COL: pl.String},
        ),
        relations=_frame(
            [
                {
                    EID_COL: row["source"],
                    OID_COL: row["target"],
                    E2O_QUALIFIER: row.get("qualifier"),
                }
                for row in e2o
            ],
            {EID_COL: pl.String, OID_COL: pl.String, E2O_QUALIFIER: pl.String},
        ),
        o2o=_frame(
            [
                {
                    O2O_SOURCE_ID: row["source"],
                    O2O_TARGET_ID: row["target"],
                    O2O_QUALIFIER: row.get("qualifier"),
                }
                for row in o2o
            ],
            {
                O2O_SOURCE_ID: pl.String,
                O2O_TARGET_ID: pl.String,
                O2O_QUALIFIER: pl.String,
            },
        ),
    )
    if change_rows:
        log.objects.changes_table = _frame(
            change_rows,
            {
                OID_COL: pl.String,
                TIMESTAMP_COL: pl.Datetime("us"),
                OBJECT_CHANGED_FIELD: pl.String,
            },
        )
    return log


class Queryable(Protocol):
    def sql(self, query: str) -> duckdb.DuckDBPyRelation: ...


CORE_TABLES = (
    EVENTS_TABLE,
    OBJECTS_TABLE,
    OBJECT_CHANGES_TABLE,
    E2O_TABLE,
    O2O_TABLE,
)


def _column(source: Queryable, query: str) -> set[Any]:
    return {row[0] for row in source.sql(query).fetchall()}


def _pairs(source: Queryable, query: str) -> set[tuple[str, str]]:
    return {(row[0], row[1]) for row in source.sql(query).fetchall()}


def event_ids(source: Queryable) -> set[str]:
    return _column(source, f"SELECT {ident(EID_COL)} FROM {EVENTS_TABLE}")


def object_ids(source: Queryable) -> set[str]:
    return _column(source, f"SELECT {ident(OID_COL)} FROM {OBJECTS_TABLE}")


def changed_object_ids(source: Queryable) -> set[str]:
    return _column(source, f"SELECT {ident(OID_COL)} FROM {OBJECT_CHANGES_TABLE}")


def e2o_pairs(source: Queryable) -> set[tuple[str, str]]:
    return _pairs(source, f"SELECT {ident(EID_COL)}, {ident(OID_COL)} FROM {E2O_TABLE}")


def o2o_pairs(source: Queryable) -> set[tuple[str, str]]:
    return _pairs(
        source,
        f"SELECT {ident(O2O_SOURCE_ID)}, {ident(O2O_TARGET_ID)} FROM {O2O_TABLE}",
    )


def snapshot(source: Queryable) -> dict[str, list[tuple[Any, ...]]]:
    return {
        table: source.sql(f"FROM {table} ORDER BY ALL").fetchall()
        for table in CORE_TABLES
    }


class KeepIds(ViewOperation):
    def __init__(self, table: str, ids: set[str]):
        self.table = table
        self.ids = ids

    def build(self, step: Step) -> None:
        column = EID_COL if self.table == EVENTS_TABLE else OID_COL
        values = ", ".join(literal(id) for id in sorted(self.ids))
        step.keep(
            self.table,
            f"SELECT unnest([{values}]::VARCHAR[]) AS {ident(column)}",
        )
