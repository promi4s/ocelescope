from __future__ import annotations

import pandas as pd
from pydantic import BaseModel, Field

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL, OTYPE_COL

from ocelescope_module_querying.errors import InvalidAnalysisQuery


class ObjectTypeCombinationsQuery(BaseModel):
    limit: int = Field(default=15, ge=1, le=50)
    activities: list[str] = Field(default_factory=list)


class ObjectTypeCombinationRow(BaseModel):
    object_types: list[str]
    activity: str
    event_count: int


class ObjectTypeCombinationsResponse(BaseModel):
    rows: list[ObjectTypeCombinationRow]
    total_event_count: int
    represented_event_count: int
    total_combination_count: int
    truncated: bool


def _object_type_combination_frequencies(
    events: pd.DataFrame,
    relations: pd.DataFrame,
    limit: int,
    activities: set[str] | None = None,
) -> tuple[pd.DataFrame, int, int, int]:
    """Return activity frequencies for the most common exact type combinations."""
    event_population = events.loc[:, [EID_COL, ACTIVITY_COL]].drop_duplicates(
        subset=[EID_COL]
    )
    if activities:
        event_population = event_population.loc[
            event_population[ACTIVITY_COL].isin(activities)
        ]
    presence = relations.loc[:, [EID_COL, OTYPE_COL]].dropna().drop_duplicates()
    combinations = (
        presence.groupby(EID_COL, observed=True, sort=False)[OTYPE_COL]
        .agg(lambda values: tuple(sorted(str(value) for value in values)))
        .rename("object_types")
        .reset_index()
    )
    population = event_population.merge(
        combinations,
        on=EID_COL,
        how="left",
        validate="one_to_one",
    )
    population["object_types"] = population["object_types"].map(
        lambda value: value if isinstance(value, tuple) else ()
    )
    totals = (
        population.groupby("object_types", observed=True, sort=False)
        .size()
        .rename("combination_event_count")
        .reset_index()
    )
    totals["_sort_key"] = totals["object_types"].map(lambda values: "\x1f".join(values))
    totals = totals.sort_values(
        ["combination_event_count", "_sort_key"],
        ascending=[False, True],
        kind="stable",
    )
    selected = list(totals.head(limit)["object_types"])
    selected_population = population.loc[population["object_types"].isin(selected)]
    rank = {combination: index for index, combination in enumerate(selected)}
    result = (
        selected_population.groupby(
            ["object_types", ACTIVITY_COL],
            observed=True,
            sort=False,
        )
        .size()
        .rename("event_count")
        .reset_index()
    )
    result["_rank"] = result["object_types"].map(rank)
    result = result.sort_values(
        ["_rank", ACTIVITY_COL],
        kind="stable",
    ).drop(columns="_rank")
    return (
        result.reset_index(drop=True),
        len(event_population),
        len(selected_population),
        len(totals),
    )


def execute_object_type_combinations_query(
    ocel: OCEL,
    query: ObjectTypeCombinationsQuery,
    *,
    known_activities: set[str] | None = None,
) -> ObjectTypeCombinationsResponse:
    requested = set(query.activities)
    available = known_activities or {str(value) for value in ocel.events.activities}
    unknown = requested - available
    if unknown:
        names = ", ".join(sorted(unknown))
        raise InvalidAnalysisQuery(f"Unknown activities: {names}")

    rows, total_events, represented_events, total_combinations = (
        _object_type_combination_frequencies(
            ocel.events.df,
            ocel.e2o.df,
            query.limit,
            requested,
        )
    )
    return ObjectTypeCombinationsResponse(
        rows=[
            ObjectTypeCombinationRow(
                object_types=list(row["object_types"]),
                activity=str(row[ACTIVITY_COL]),
                event_count=int(row["event_count"]),
            )
            for _, row in rows.iterrows()
        ],
        total_event_count=total_events,
        represented_event_count=represented_events,
        total_combination_count=total_combinations,
        truncated=total_combinations > query.limit,
    )
