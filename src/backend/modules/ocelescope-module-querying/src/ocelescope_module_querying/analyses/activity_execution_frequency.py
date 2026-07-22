from __future__ import annotations

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL

from ocelescope_module_querying.errors import InvalidAnalysisQuery

_EXECUTION_FREQUENCY_BANDS: tuple[tuple[int, int | None], ...] = (
    (1, 1),
    (2, 2),
    (3, 5),
    (6, 10),
    (11, 20),
    (21, 50),
    (51, 100),
    (101, 500),
    (501, 1000),
    (1001, None),
)


class ActivityExecutionFrequencyQuery(BaseModel):
    object_type: str


class ActivityExecutionFrequencyRow(BaseModel):
    activity: str
    lower_bound: int
    upper_bound: int | None
    label: str
    object_count: int


class ActivityExecutionFrequencyResponse(BaseModel):
    rows: list[ActivityExecutionFrequencyRow]
    object_activity_pair_count: int
    object_count: int
    maximum_execution_count: int


def _activity_execution_frequency_bands(
    events: pd.DataFrame,
    relations: pd.DataFrame,
    object_type: str,
) -> tuple[pd.DataFrame, int, int, int]:
    """Count executions per object and activity, then assign bounded bands."""
    pairs = relations.loc[
        relations[OTYPE_COL].eq(object_type),
        [EID_COL, OID_COL],
    ].drop_duplicates()
    if pairs.empty:
        return (
            pd.DataFrame(
                columns=[
                    ACTIVITY_COL,
                    "lower_bound",
                    "upper_bound",
                    "label",
                    "object_count",
                ]
            ),
            0,
            0,
            0,
        )

    event_data = events.loc[:, [EID_COL, ACTIVITY_COL]].drop_duplicates(
        subset=[EID_COL]
    )
    population = pairs.merge(
        event_data,
        on=EID_COL,
        how="inner",
        validate="many_to_one",
    ).dropna(subset=[ACTIVITY_COL])
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

    def band(execution_count: int) -> tuple[int, int | None]:
        return next(
            (lower, upper)
            for lower, upper in _EXECUTION_FREQUENCY_BANDS
            if execution_count >= lower and (upper is None or execution_count <= upper)
        )

    counts["_band"] = counts["execution_count"].map(band)
    counts["lower_bound"] = counts["_band"].map(lambda value: value[0])
    counts["upper_bound"] = counts["_band"].map(lambda value: value[1])
    counts["label"] = counts["_band"].map(
        lambda value: (
            f"{value[0]}+"
            if value[1] is None
            else str(value[0])
            if value[0] == value[1]
            else f"{value[0]}–{value[1]}"
        )
    )
    frequencies = (
        counts.groupby(
            [ACTIVITY_COL, "lower_bound", "upper_bound", "label"],
            observed=True,
            sort=False,
            dropna=False,
        )
        .size()
        .rename("object_count")
        .reset_index()
        .sort_values(
            [ACTIVITY_COL, "lower_bound"],
            kind="stable",
        )
        .reset_index(drop=True)
    )
    return (
        frequencies,
        len(counts),
        int(population[OID_COL].nunique()),
        int(counts["execution_count"].max()),
    )


def execute_activity_execution_frequency_query(
    ocel: OCEL,
    query: ActivityExecutionFrequencyQuery,
    *,
    known_object_types: set[str] | None = None,
) -> ActivityExecutionFrequencyResponse:
    available = known_object_types or set(ocel.objects.types)
    if query.object_type not in available:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")

    rows, pair_count, object_count, maximum = _activity_execution_frequency_bands(
        ocel.events.df,
        ocel.e2o.df,
        query.object_type,
    )
    return ActivityExecutionFrequencyResponse(
        rows=[
            ActivityExecutionFrequencyRow(
                activity=str(row[ACTIVITY_COL]),
                lower_bound=int(row["lower_bound"]),
                upper_bound=(
                    None if pd.isna(row["upper_bound"]) else int(row["upper_bound"])
                ),
                label=str(row["label"]),
                object_count=int(row["object_count"]),
            )
            for _, row in rows.iterrows()
        ],
        object_activity_pair_count=pair_count,
        object_count=object_count,
        maximum_execution_count=maximum,
    )
