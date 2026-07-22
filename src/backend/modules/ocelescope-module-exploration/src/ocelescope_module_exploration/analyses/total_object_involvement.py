from __future__ import annotations

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL, OID_COL


class TotalObjectInvolvementRow(BaseModel):
    activity: str
    object_count: int
    event_count: int


class TotalObjectInvolvementResponse(BaseModel):
    rows: list[TotalObjectInvolvementRow]
    event_count: int


def _total_object_involvement_frequencies(
    events: pd.DataFrame,
    relations: pd.DataFrame,
) -> tuple[pd.DataFrame, int]:
    """Count events by activity and total number of distinct involved objects."""
    event_population = events.loc[:, [EID_COL, ACTIVITY_COL]].drop_duplicates(
        subset=[EID_COL]
    )
    counts = (
        relations.loc[:, [EID_COL, OID_COL]]
        .drop_duplicates()
        .groupby(EID_COL, observed=True)[OID_COL]
        .nunique()
        .rename("object_count")
    )
    population = event_population.merge(
        counts,
        on=EID_COL,
        how="left",
        validate="one_to_one",
    )
    population["object_count"] = population["object_count"].fillna(0).astype(int)
    frequencies = (
        population.groupby(
            [ACTIVITY_COL, "object_count"],
            observed=True,
            sort=False,
        )
        .size()
        .rename("event_count")
        .reset_index()
        .sort_values(["object_count", ACTIVITY_COL], kind="stable")
        .reset_index(drop=True)
    )
    return frequencies, len(event_population)


def execute_total_object_involvement_query(
    ocel: OCEL,
) -> TotalObjectInvolvementResponse:
    rows, event_count = _total_object_involvement_frequencies(
        ocel.events.df,
        ocel.e2o.df,
    )
    return TotalObjectInvolvementResponse(
        rows=[
            TotalObjectInvolvementRow(
                activity=str(row[ACTIVITY_COL]),
                object_count=int(row["object_count"]),
                event_count=int(row["event_count"]),
            )
            for _, row in rows.iterrows()
        ],
        event_count=event_count,
    )
