from __future__ import annotations

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL

from ocelescope_module_querying.errors import InvalidAnalysisQuery


class ObjectActivityExecutionDistributionQuery(BaseModel):
    object_type: str


class ObjectActivityExecutionDistributionRow(BaseModel):
    activity: str
    execution_count: int
    object_count: int


class ObjectActivityExecutionDistributionResponse(BaseModel):
    rows: list[ObjectActivityExecutionDistributionRow]
    contributing_object_count: int
    activity_count: int


def _variable_activity_execution_frequencies(
    events: pd.DataFrame,
    relations: pd.DataFrame,
    object_type: str,
) -> tuple[pd.DataFrame, int, int]:
    """Return exact object execution frequencies for activities with loops."""
    pairs = relations.loc[
        relations[OTYPE_COL].eq(object_type),
        [EID_COL, OID_COL],
    ].drop_duplicates()
    event_data = events.loc[:, [EID_COL, ACTIVITY_COL]].drop_duplicates(
        subset=[EID_COL]
    )
    population = pairs.merge(
        event_data,
        on=EID_COL,
        how="inner",
        validate="many_to_one",
    ).dropna(subset=[ACTIVITY_COL])
    if population.empty:
        return (
            pd.DataFrame(columns=[ACTIVITY_COL, "execution_count", "object_count"]),
            0,
            0,
        )
    counts = (
        population.groupby(
            [OID_COL, ACTIVITY_COL],
            observed=True,
            sort=False,
        )
        .size()
        .rename("execution_count")
        .reset_index()
    )
    variable_activities = counts.groupby(ACTIVITY_COL, observed=True)[
        "execution_count"
    ].max()
    variable_activities = set(variable_activities.loc[lambda values: values > 1].index)
    selected = counts.loc[counts[ACTIVITY_COL].isin(variable_activities)]
    frequencies = (
        selected.groupby(
            [ACTIVITY_COL, "execution_count"],
            observed=True,
            sort=False,
        )
        .size()
        .rename("object_count")
        .reset_index()
        .sort_values([ACTIVITY_COL, "execution_count"], kind="stable")
        .reset_index(drop=True)
    )
    return (
        frequencies,
        int(selected[OID_COL].nunique()),
        len(variable_activities),
    )


def execute_object_activity_execution_distribution_query(
    ocel: OCEL,
    query: ObjectActivityExecutionDistributionQuery,
    *,
    known_object_types: set[str] | None = None,
) -> ObjectActivityExecutionDistributionResponse:
    available = known_object_types or set(ocel.objects.types)
    if query.object_type not in available:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")
    rows, object_count, activity_count = _variable_activity_execution_frequencies(
        ocel.events.df,
        ocel.e2o.df,
        query.object_type,
    )
    return ObjectActivityExecutionDistributionResponse(
        rows=[
            ObjectActivityExecutionDistributionRow(
                activity=str(row[ACTIVITY_COL]),
                execution_count=int(row["execution_count"]),
                object_count=int(row["object_count"]),
            )
            for _, row in rows.iterrows()
        ],
        contributing_object_count=object_count,
        activity_count=activity_count,
    )
