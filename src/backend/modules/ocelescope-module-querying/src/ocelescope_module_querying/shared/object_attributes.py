from __future__ import annotations

from typing import cast

import numpy as np
import pandas as pd

from ocelescope import OCEL
from ocelescope.ocel.constants import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)

INITIAL_TIMESTAMP = pd.Timestamp("1970-01-01", tz="UTC")


def object_attribute_observations(
    ocel: OCEL, object_type: str, attribute: str
) -> pd.DataFrame:
    """Return ordered initial and changed values for one object attribute."""
    frames: list[pd.DataFrame] = []
    objects = ocel.objects.df.loc[ocel.objects.df[OTYPE_COL].eq(object_type)]
    if attribute in objects.columns:
        base = objects.loc[objects[attribute].notna(), [OID_COL, attribute]].copy()
        base[TIMESTAMP_COL] = INITIAL_TIMESTAMP
        base["_source"] = "initial"
        base["_source_order"] = 0
        frames.append(base)

    changes = ocel.objects.changes.loc[ocel.objects.changes[OTYPE_COL].eq(object_type)]
    if attribute in changes.columns:
        changed = changes.loc[
            changes[attribute].notna(), [OID_COL, TIMESTAMP_COL, attribute]
        ].copy()
        changed[TIMESTAMP_COL] = pd.to_datetime(
            changed[TIMESTAMP_COL], errors="coerce", utc=True
        )
        changed["_source"] = "change"
        changed["_source_order"] = 1
        frames.append(changed)

    columns = [OID_COL, TIMESTAMP_COL, attribute, "_source", "_source_order"]
    if not frames:
        return pd.DataFrame(columns=columns)
    return (
        pd.concat(frames, ignore_index=True)
        .drop_duplicates(subset=[OID_COL, TIMESTAMP_COL, attribute])
        .sort_values([OID_COL, TIMESTAMP_COL, "_source_order"], kind="stable")
        .reset_index(drop=True)
    )


def event_object_pairs(ocel: OCEL, activity: str, object_type: str) -> pd.DataFrame:
    """Return unique, timestamped event-object pairs for a semantic scope."""
    selected = ocel.e2o.df.loc[
        ocel.e2o.df[ACTIVITY_COL].eq(activity) & ocel.e2o.df[OTYPE_COL].eq(object_type),
        [EID_COL, OID_COL],
    ].drop_duplicates()
    if selected.empty:
        return pd.DataFrame(columns=[EID_COL, OID_COL, TIMESTAMP_COL])

    event_times = ocel.events.df.loc[:, [EID_COL, TIMESTAMP_COL]].copy()
    event_times[TIMESTAMP_COL] = pd.to_datetime(
        event_times[TIMESTAMP_COL], errors="coerce", utc=True
    )
    return (
        selected.merge(event_times, on=EID_COL, how="left", validate="many_to_one")
        .dropna(subset=[TIMESTAMP_COL])
        .reset_index(drop=True)
    )


def resolve_attribute_at_event_object_pairs(
    pairs: pd.DataFrame,
    observations: pd.DataFrame,
    attribute: str,
) -> pd.Series:
    """Resolve the latest value at or before each event-object pair."""
    if pairs.empty:
        return pd.Series(dtype="object", name=attribute)
    if observations.empty:
        return pd.Series(np.nan, index=range(len(pairs)), name=attribute)

    ordered_observations = observations.copy()
    ordered_observations[TIMESTAMP_COL] = pd.to_datetime(
        ordered_observations[TIMESTAMP_COL], errors="coerce", utc=True
    )
    ordered_observations = (
        ordered_observations.dropna(subset=[TIMESTAMP_COL])
        .sort_values([OID_COL, TIMESTAMP_COL, "_source_order"], kind="stable")
        .drop_duplicates(subset=[OID_COL, TIMESTAMP_COL], keep="last")
        .sort_values([TIMESTAMP_COL, OID_COL], kind="stable")
    )
    ordered_pairs = pairs.sort_values([TIMESTAMP_COL, OID_COL], kind="stable")
    resolved = pd.merge_asof(
        ordered_pairs,
        ordered_observations.loc[:, [OID_COL, TIMESTAMP_COL, attribute]],
        on=TIMESTAMP_COL,
        by=OID_COL,
        direction="backward",
        allow_exact_matches=True,
    )
    return cast(pd.Series, resolved[attribute].reset_index(drop=True))


def object_attribute_values_at_activity(
    ocel: OCEL,
    activity: str,
    object_type: str,
    attribute: str,
) -> pd.Series:
    """Resolve an attribute for every unique matching event-object pair."""
    return resolve_attribute_at_event_object_pairs(
        event_object_pairs(ocel, activity, object_type),
        object_attribute_observations(ocel, object_type, attribute),
        attribute,
    )
