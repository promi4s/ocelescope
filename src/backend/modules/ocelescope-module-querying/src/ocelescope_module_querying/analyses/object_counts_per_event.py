from __future__ import annotations

import pandas as pd
from pydantic import BaseModel, Field

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL

from ocelescope_module_querying.errors import InvalidAnalysisQuery


class ObjectCountsPerEventQuery(BaseModel):
    activities: list[str] = Field(default_factory=list)


class ObjectCountPerEventRow(BaseModel):
    activity: str
    object_type: str
    object_count: int
    event_count: int


class ActivityEventCount(BaseModel):
    activity: str
    event_count: int


class ObjectCountsPerEventResponse(BaseModel):
    rows: list[ObjectCountPerEventRow]
    activity_event_counts: list[ActivityEventCount]


def _object_count_frequencies(
    relations: pd.DataFrame,
    activities: set[str] | None = None,
) -> pd.DataFrame:
    """Aggregate unique event-object relations by activity, type, and count."""
    unique = relations.loc[
        :,
        [EID_COL, ACTIVITY_COL, OID_COL, OTYPE_COL],
    ].drop_duplicates(subset=[EID_COL, OID_COL])
    if activities:
        unique = unique.loc[unique[ACTIVITY_COL].isin(activities)]
    if unique.empty:
        return pd.DataFrame(
            columns=[ACTIVITY_COL, OTYPE_COL, "object_count", "event_count"]
        )

    counts = (
        unique.groupby(
            [ACTIVITY_COL, EID_COL, OTYPE_COL],
            observed=True,
            sort=False,
        )[OID_COL]
        .nunique()
        .rename("object_count")
        .reset_index()
    )
    return (
        counts.groupby(
            [ACTIVITY_COL, OTYPE_COL, "object_count"],
            observed=True,
            sort=False,
        )
        .size()
        .rename("event_count")
        .reset_index()
        .sort_values(
            [ACTIVITY_COL, OTYPE_COL, "object_count"],
            kind="stable",
        )
        .reset_index(drop=True)
    )


def _unique_event_counts(
    relations: pd.DataFrame,
    activities: set[str] | None = None,
) -> pd.DataFrame:
    """Count each event once per activity, independent of object involvement."""
    events = relations.loc[:, [EID_COL, ACTIVITY_COL]].drop_duplicates()
    if activities:
        events = events.loc[events[ACTIVITY_COL].isin(activities)]
    return (
        events.groupby(ACTIVITY_COL, observed=True, sort=False)[EID_COL]
        .nunique()
        .rename("event_count")
        .reset_index()
        .sort_values(ACTIVITY_COL, kind="stable")
        .reset_index(drop=True)
    )


def execute_object_counts_per_event_query(
    ocel: OCEL,
    query: ObjectCountsPerEventQuery,
    *,
    known_activities: set[str] | None = None,
) -> ObjectCountsPerEventResponse:
    """Count how often events involve exactly n unique objects of each type."""
    requested = set(query.activities)
    available = known_activities or {str(value) for value in ocel.events.activities}
    unknown = requested - available
    if unknown:
        names = ", ".join(sorted(unknown))
        raise InvalidAnalysisQuery(f"Unknown activities: {names}")

    frequencies = _object_count_frequencies(ocel.e2o.df, requested)
    activity_counts = _unique_event_counts(ocel.e2o.df, requested)
    return ObjectCountsPerEventResponse(
        rows=[
            ObjectCountPerEventRow(
                activity=str(row[ACTIVITY_COL]),
                object_type=str(row[OTYPE_COL]),
                object_count=int(row["object_count"]),
                event_count=int(row["event_count"]),
            )
            for _, row in frequencies.iterrows()
        ],
        activity_event_counts=[
            ActivityEventCount(
                activity=str(row[ACTIVITY_COL]),
                event_count=int(row["event_count"]),
            )
            for _, row in activity_counts.iterrows()
        ],
    )
