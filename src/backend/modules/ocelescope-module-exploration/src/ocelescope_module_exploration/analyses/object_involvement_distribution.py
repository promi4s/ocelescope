from __future__ import annotations

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL

from ocelescope_module_exploration.errors import InvalidAnalysisQuery
from ocelescope_module_exploration.shared.distributions import (
    DistributionGrouping,
    DistributionResponse,
    calculate_distribution,
)


class ObjectInvolvementDistributionQuery(BaseModel):
    activity: str
    object_type: str
    grouping: DistributionGrouping


def _variable_object_involvement_pairs(
    events: pd.DataFrame,
    relations: pd.DataFrame,
) -> pd.DataFrame:
    """Describe existing activity–type pairs whose event counts are not always one."""
    event_totals = (
        events.loc[:, [EID_COL, ACTIVITY_COL]]
        .drop_duplicates()
        .groupby(ACTIVITY_COL, observed=True)[EID_COL]
        .nunique()
        .rename("activity_event_count")
    )
    counts = (
        relations.loc[:, [EID_COL, ACTIVITY_COL, OTYPE_COL, OID_COL]]
        .drop_duplicates()
        .groupby(
            [ACTIVITY_COL, EID_COL, OTYPE_COL],
            observed=True,
        )[OID_COL]
        .nunique()
        .rename("object_count")
        .reset_index()
    )
    if counts.empty:
        return pd.DataFrame(columns=[ACTIVITY_COL, OTYPE_COL, "minimum", "maximum"])
    summary = (
        counts.groupby(
            [ACTIVITY_COL, OTYPE_COL],
            observed=True,
        )
        .agg(
            minimum=("object_count", "min"),
            maximum=("object_count", "max"),
            represented_event_count=(EID_COL, "nunique"),
        )
        .reset_index()
        .merge(event_totals, on=ACTIVITY_COL, validate="many_to_one")
    )
    summary.loc[
        summary["represented_event_count"] < summary["activity_event_count"],
        "minimum",
    ] = 0
    return (
        summary.loc[
            summary["minimum"].ne(1) | summary["maximum"].ne(1),
            [ACTIVITY_COL, OTYPE_COL, "minimum", "maximum"],
        ]
        .sort_values([ACTIVITY_COL, OTYPE_COL], kind="stable")
        .reset_index(drop=True)
    )


def _object_involvement_counts(
    events: pd.DataFrame,
    relations: pd.DataFrame,
    activity: str,
    object_type: str,
) -> pd.Series:
    """Count distinct objects of one type for every event of an activity."""
    population = events.loc[
        events[ACTIVITY_COL].eq(activity),
        [EID_COL],
    ].drop_duplicates()
    involved = (
        relations.loc[
            relations[ACTIVITY_COL].eq(activity) & relations[OTYPE_COL].eq(object_type),
            [EID_COL, OID_COL],
        ]
        .drop_duplicates()
        .groupby(EID_COL, observed=True)[OID_COL]
        .nunique()
        .rename("object_count")
    )
    return (
        population.merge(
            involved,
            on=EID_COL,
            how="left",
            validate="one_to_one",
        )["object_count"]
        .fillna(0)
        .astype(int)
        .reset_index(drop=True)
    )


def execute_object_involvement_distribution_query(
    ocel: OCEL,
    query: ObjectInvolvementDistributionQuery,
    *,
    classification_ocel: OCEL | None = None,
) -> DistributionResponse:
    reference_ocel = classification_ocel or ocel
    valid_pairs = _variable_object_involvement_pairs(
        reference_ocel.events.df,
        reference_ocel.e2o.df,
    )
    valid = valid_pairs.loc[
        valid_pairs[ACTIVITY_COL].eq(query.activity)
        & valid_pairs[OTYPE_COL].eq(query.object_type)
    ]
    if valid.empty:
        raise InvalidAnalysisQuery(
            f"Activity '{query.activity}' and object type '{query.object_type}' "
            "do not form a variable involvement relation"
        )
    values = _object_involvement_counts(
        ocel.events.df,
        ocel.e2o.df,
        query.activity,
        query.object_type,
    )
    return calculate_distribution(
        values,
        "discrete",
        query.grouping,
    )
