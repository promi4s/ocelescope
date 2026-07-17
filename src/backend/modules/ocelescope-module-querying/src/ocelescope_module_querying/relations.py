from __future__ import annotations

import pandas as pd

from ocelescope.ocel.constants import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)

EXECUTION_FREQUENCY_BANDS: tuple[tuple[int, int | None], ...] = (
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


def consecutive_activity_pair_durations(
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
    ordered["_next_event_id"] = ordered.groupby(OID_COL, sort=False)[EID_COL].shift(
        -1
    )
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


def object_count_frequencies(
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


def unique_event_counts(
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


def object_type_combination_frequencies(
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


def activity_execution_frequency_bands(
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
            for lower, upper in EXECUTION_FREQUENCY_BANDS
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


def variable_activity_execution_frequencies(
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
            pd.DataFrame(
                columns=[ACTIVITY_COL, "execution_count", "object_count"]
            ),
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
    variable_activities = counts.groupby(
        ACTIVITY_COL, observed=True
    )["execution_count"].max()
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


def total_object_involvement_frequencies(
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


def object_involvement_counts(
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


def variable_object_involvement_pairs(
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
