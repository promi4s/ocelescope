"""Frequency tables: counts of events or objects, grouped by what they involve.

Each population keeps its own named totals in `meta`, because the populations
differ - events, objects, object-activity pairs - and must not be conflated.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ocelescope_module_exploration.log import Log, Result

#: How often each object of type $1 executed each activity.
EXECUTIONS = """
executions AS (
    SELECT oid, activity, count(*) AS executions FROM rel WHERE type = $1 GROUP BY ALL
)"""

#: Events of the activities in $1, or of every activity when $1 is empty.
SCOPED_EVENTS = """
scoped AS (SELECT * FROM rel WHERE len($1) = 0 OR list_contains($1, activity))"""


class TotalObjectInvolvement(BaseModel):
    """Events by how many distinct objects they involve, per activity.
    Events without any object count as involving zero."""

    analysis: Literal["total-object-involvement"]

    def run(self, log: Log) -> Result:
        rows = log.rows("""
            per_event AS (
                SELECT ev.activity, count(DISTINCT rel.oid) AS object_count
                FROM ev LEFT JOIN rel USING (eid) GROUP BY ev.eid, ev.activity
            )
            SELECT activity, object_count, count(*) AS event_count
            FROM per_event GROUP BY ALL ORDER BY object_count, activity
        """)
        return Result(
            rows=rows, meta={"event_count": sum(r["event_count"] for r in rows)}
        )


class ObjectCountsPerEvent(BaseModel):
    """Events by how many distinct objects of each type they involve."""

    analysis: Literal["object-counts-per-event"]
    activities: list[str] = Field(default_factory=list)
    """Empty means every activity."""

    def run(self, log: Log) -> Result:
        log.require_activities(*self.activities)
        rows = log.rows(
            f"""{SCOPED_EVENTS}
            SELECT activity, type AS object_type, object_count, count(*) AS event_count
            FROM (
                SELECT activity, type, eid, count(DISTINCT oid) AS object_count
                FROM scoped GROUP BY ALL
            )
            GROUP BY ALL ORDER BY ALL""",
            self.activities,
        )
        # Object types overlap within an event, so an activity's own event
        # count is reported separately rather than summed from its rows.
        totals = log.rows(
            f"""{SCOPED_EVENTS}
            SELECT activity, count(DISTINCT eid) AS events FROM scoped GROUP BY activity""",
            self.activities,
        )
        return Result(
            rows=rows,
            meta={
                "activity_event_counts": {t["activity"]: t["events"] for t in totals}
            },
        )


class ObjectTypeCombinations(BaseModel):
    """The most frequent exact sets of object types per event, by activity."""

    analysis: Literal["object-type-combinations"]
    limit: int = Field(default=15, ge=1, le=50)
    activities: list[str] = Field(default_factory=list)
    """Empty means every activity."""

    def run(self, log: Log) -> Result:
        log.require_activities(*self.activities)
        # Every event of the scope takes part, those without objects as the
        # empty set. Sets rank by frequency, then by their type names.
        sets = """
            events AS (
                SELECT eid, activity FROM ev WHERE len($1) = 0 OR list_contains($1, activity)
            ),
            sets AS (
                SELECT events.activity, coalesce(
                    list_sort(list(DISTINCT rel.type) FILTER (WHERE rel.type IS NOT NULL)),
                    []::VARCHAR[]
                ) AS object_types
                FROM events LEFT JOIN rel USING (eid) GROUP BY events.eid, events.activity
            )"""
        rows = log.rows(
            f"""{sets},
            ranked AS (
                SELECT object_types,
                       row_number() OVER (ORDER BY count(*) DESC, object_types) AS rank
                FROM sets GROUP BY object_types
            )
            SELECT object_types, activity, count(*) AS event_count
            FROM sets JOIN ranked USING (object_types)
            WHERE rank <= $2
            GROUP BY object_types, activity, rank ORDER BY rank, activity""",
            self.activities,
            self.limit,
        )
        (totals,) = log.rows(
            f"""{sets}
            SELECT count(*) AS events, count(DISTINCT object_types) AS combinations FROM sets""",
            self.activities,
        )
        return Result(
            rows=rows,
            meta={
                "total_event_count": totals["events"],
                "represented_event_count": sum(r["event_count"] for r in rows),
                "total_combination_count": totals["combinations"],
                "truncated": totals["combinations"] > self.limit,
            },
        )


class ActivityExecutionFrequency(BaseModel):
    """Objects of a type by how often they executed each activity, in bands."""

    analysis: Literal["activity-execution-frequency"]
    object_type: str

    def run(self, log: Log) -> Result:
        log.require_object_type(self.object_type)
        rows = log.rows(
            f"""{EXECUTIONS},
            bands(low, high) AS (VALUES
                (1, 1), (2, 2), (3, 5), (6, 10), (11, 20), (21, 50),
                (51, 100), (101, 500), (501, 1000), (1001, NULL)
            )
            SELECT activity, low, high,
                   CASE WHEN high IS NULL THEN low || '+'
                        WHEN low = high THEN low::VARCHAR
                        ELSE low || '–' || high END AS band,
                   count(*) AS object_count
            FROM executions JOIN bands
              ON executions >= low AND executions <= coalesce(high, executions)
            GROUP BY ALL ORDER BY activity, low""",
            self.object_type,
        )
        (meta,) = log.rows(
            f"""{EXECUTIONS}
            SELECT count(DISTINCT oid) AS object_count,
                   count(*) AS object_activity_pair_count,
                   coalesce(max(executions), 0) AS maximum_execution_count
            FROM executions""",
            self.object_type,
        )
        return Result(rows=rows, meta=meta)


class ObjectActivityExecutionDistribution(BaseModel):
    """Exact execution counts per object, for activities some object repeats."""

    analysis: Literal["object-activity-execution-distribution"]
    object_type: str

    def run(self, log: Log) -> Result:
        log.require_object_type(self.object_type)
        repeated = f"""{EXECUTIONS},
            repeated AS (
                SELECT * FROM executions
                QUALIFY max(executions) OVER (PARTITION BY activity) > 1
            )"""
        rows = log.rows(
            f"""{repeated}
            SELECT activity, executions AS execution_count, count(*) AS object_count
            FROM repeated GROUP BY ALL ORDER BY ALL""",
            self.object_type,
        )
        (meta,) = log.rows(
            f"""{repeated}
            SELECT count(DISTINCT oid) AS object_count, count(DISTINCT activity) AS activity_count
            FROM repeated""",
            self.object_type,
        )
        return Result(rows=rows, meta=meta)
