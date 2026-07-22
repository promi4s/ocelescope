from __future__ import annotations

from typing import Literal

import pandas as pd
from pydantic import BaseModel, Field

from ocelescope import OCEL
from ocelescope.ocel.constants import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)

from ocelescope_module_exploration.errors import InvalidAnalysisQuery
from ocelescope_module_exploration.shared.distributions import (
    DistributionBucket,
    NumericBinGrouping,
    QueryCounts,
    calculate_distribution,
)

_SECONDS_PER_UNIT = {
    "seconds": 1,
    "minutes": 60,
    "hours": 60 * 60,
    "days": 24 * 60 * 60,
}

TimeUnit = Literal["seconds", "minutes", "hours", "days"]


class TimeBetweenActivitiesQuery(BaseModel):
    source_activity: str
    target_activity: str
    object_type: str
    unit: TimeUnit
    bin_count: int | None = Field(default=None, ge=1, le=200)


class TimeBetweenActivitiesResponse(BaseModel):
    buckets: list[DistributionBucket]
    counts: QueryCounts
    truncated: bool
    unit: TimeUnit
    pair_count: int
    contributing_object_count: int


def _consecutive_activity_pair_durations(
    events: pd.DataFrame,
    relations: pd.DataFrame,
    source_activity: str,
    target_activity: str,
    object_type: str,
) -> pd.DataFrame:
    """Return source→target durations in traces filtered to the two activities.

    Each unique event-object relation is considered once. Unrelated activities
    are removed before consecutive pairs are identified, matching the
    subsequence semantics used by the original QRPM analysis.
    """
    event_data = events.loc[
        events[ACTIVITY_COL].isin([source_activity, target_activity]),
        [EID_COL, ACTIVITY_COL, TIMESTAMP_COL],
    ].drop_duplicates(subset=[EID_COL])
    object_events = (
        relations.loc[
            relations[OTYPE_COL].eq(object_type),
            [EID_COL, OID_COL],
        ]
        .drop_duplicates()
        .merge(event_data, on=EID_COL, how="inner", validate="many_to_one")
    )
    if object_events.empty:
        return pd.DataFrame(
            columns=[
                OID_COL,
                "source_event_id",
                "target_event_id",
                "duration_seconds",
            ]
        )

    # Event IDs provide deterministic ordering when timestamps are equal.
    ordered = object_events.sort_values(
        [OID_COL, TIMESTAMP_COL, EID_COL],
        kind="stable",
    )
    ordered["_next_event_id"] = ordered.groupby(OID_COL, sort=False)[EID_COL].shift(-1)
    ordered["_next_activity"] = ordered.groupby(OID_COL, sort=False)[
        ACTIVITY_COL
    ].shift(-1)
    ordered["_next_timestamp"] = ordered.groupby(OID_COL, sort=False)[
        TIMESTAMP_COL
    ].shift(-1)
    pairs = ordered.loc[
        ordered[ACTIVITY_COL].eq(source_activity)
        & ordered["_next_activity"].eq(target_activity)
    ].copy()
    pairs["duration_seconds"] = (
        pairs["_next_timestamp"] - pairs[TIMESTAMP_COL]
    ).dt.total_seconds()
    return (
        pairs.rename(
            columns={
                EID_COL: "source_event_id",
                "_next_event_id": "target_event_id",
            }
        )
        .loc[
            :,
            [OID_COL, "source_event_id", "target_event_id", "duration_seconds"],
        ]
        .reset_index(drop=True)
    )


def execute_time_between_activities_query(
    ocel: OCEL,
    query: TimeBetweenActivitiesQuery,
    *,
    known_activities: set[str] | None = None,
    known_object_types: set[str] | None = None,
) -> TimeBetweenActivitiesResponse:
    available_activities = known_activities or {
        str(value) for value in ocel.events.activities
    }
    unknown = {
        query.source_activity,
        query.target_activity,
    } - available_activities
    if unknown:
        raise InvalidAnalysisQuery(f"Unknown activities: {', '.join(sorted(unknown))}")
    available_object_types = known_object_types or set(ocel.objects.types)
    if query.object_type not in available_object_types:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")

    pairs = _consecutive_activity_pair_durations(
        ocel.events.df,
        ocel.e2o.df,
        query.source_activity,
        query.target_activity,
        query.object_type,
    )
    values = pairs["duration_seconds"] / _SECONDS_PER_UNIT[query.unit]
    distribution = calculate_distribution(
        values,
        "continuous",
        NumericBinGrouping(kind="bins", count=query.bin_count),
    )
    return TimeBetweenActivitiesResponse(
        **distribution.model_dump(),
        unit=query.unit,
        pair_count=len(pairs),
        contributing_object_count=int(pairs[OID_COL].nunique()),
    )
