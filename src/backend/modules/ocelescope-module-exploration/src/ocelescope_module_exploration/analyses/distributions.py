"""Distributions: one value per member of a population, grouped into buckets.

Each analysis only defines its population and how to read the value; the
bucketing is shared.
"""

from __future__ import annotations

from typing import Any, Literal

from ocelescope.util.sql import ident, literal
from pydantic import BaseModel, Field

from ocelescope_module_exploration.buckets import Bins, Grouping, buckets
from ocelescope_module_exploration.log import Log, Result, with_base

_SECONDS = {"seconds": 1, "minutes": 60, "hours": 3600, "days": 86400}


class EventAttributeDistribution(BaseModel):
    """An event attribute's values, one per event of an activity."""

    analysis: Literal["event-attribute-distribution"]
    activity: str
    attribute: str
    grouping: Grouping

    def run(self, log: Log) -> Result:
        log.require_activities(self.activity)
        kind = log.attribute_type("events", self.attribute, self.activity)
        values = log.column(
            f'SELECT {ident(self.attribute)} FROM events WHERE "ocel:activity" = $1',
            self.activity,
        )
        return buckets(values, kind, self.grouping)


class ObjectAttributeDistribution(BaseModel):
    """An object attribute's value at each event of an activity, one per
    event-object pair. A change at the event's own timestamp already applies."""

    analysis: Literal["object-attribute-distribution"]
    activity: str
    object_type: str
    attribute: str
    grouping: Grouping

    def run(self, log: Log) -> Result:
        log.require_activities(self.activity)
        log.require_object_type(self.object_type)
        kind = log.attribute_type("objects", self.attribute, self.object_type)
        return buckets(self._values(log), kind, self.grouping)

    def _values(self, log: Log) -> list[Any]:
        # `attribute_states` has each object's full state after every change,
        # carrying values forward. Rows without a value are skipped, so the
        # join finds the latest value the object actually had.
        states = log.filtered.objects.attribute_states(
            object_types=[self.object_type], attributes=[self.attribute]
        )
        pairs = (
            f"SELECT oid, ts FROM rel WHERE activity = {literal(self.activity)} "
            f"AND type = {literal(self.object_type)}"
        )
        if self.attribute not in states.columns:  # nothing left after filtering
            return log.column(f"SELECT NULL FROM ({with_base(pairs)})")
        column = ident(self.attribute)
        # `states` is a relation, bound by name, so its scope is inlined as
        # quoted literals rather than passed as parameters.
        return [
            value
            for (value,) in states.query(
                "states",
                with_base(f"""
                    known AS (
                        SELECT "ocel:oid" AS oid, "ocel:timestamp" AS ts, {column} AS value
                        FROM states WHERE {column} IS NOT NULL
                    ),
                    pairs AS ({pairs})
                    SELECT known.value FROM pairs
                    ASOF LEFT JOIN known ON pairs.oid = known.oid AND pairs.ts >= known.ts
                """),
            ).fetchall()
        ]


class ObjectInvolvementDistribution(BaseModel):
    """Distinct objects of a type per event of an activity, including zero."""

    analysis: Literal["object-involvement-distribution"]
    activity: str
    object_type: str
    grouping: Grouping

    def run(self, log: Log) -> Result:
        log.require_activities(self.activity)
        log.require_object_type(self.object_type)
        values = log.column(
            """
            SELECT count(DISTINCT rel.oid) FROM ev
            LEFT JOIN rel ON rel.eid = ev.eid AND rel.type = $2
            WHERE ev.activity = $1 GROUP BY ev.eid""",
            self.activity,
            self.object_type,
        )
        return buckets(values, "discrete", self.grouping)


class TimeBetweenActivities(BaseModel):
    """Durations from a source to a directly following target activity, once
    each object's trace is reduced to just those two activities."""

    analysis: Literal["time-between-activities"]
    source_activity: str
    target_activity: str
    object_type: str
    unit: Literal["seconds", "minutes", "hours", "days"]
    bin_count: int | None = Field(default=None, ge=1, le=200)

    def run(self, log: Log) -> Result:
        log.require_activities(self.source_activity, self.target_activity)
        log.require_object_type(self.object_type)
        pairs = log.rows(
            """
            trace AS (
                SELECT oid, activity, ts,
                       lead(activity) OVER w AS next_activity, lead(ts) OVER w AS next_ts
                FROM rel WHERE type = $3 AND activity IN ($1, $2)
                WINDOW w AS (PARTITION BY oid ORDER BY ts, eid)
            )
            SELECT oid, epoch(next_ts - ts) / $4 AS duration FROM trace
            WHERE activity = $1 AND next_activity = $2""",
            self.source_activity,
            self.target_activity,
            self.object_type,
            _SECONDS[self.unit],
        )
        result = buckets(
            [pair["duration"] for pair in pairs],
            "continuous",
            Bins(kind="bins", count=self.bin_count),
        )
        result.meta |= {
            "unit": self.unit,
            "pair_count": len(pairs),
            "contributing_object_count": len({pair["oid"] for pair in pairs}),
        }
        return result
