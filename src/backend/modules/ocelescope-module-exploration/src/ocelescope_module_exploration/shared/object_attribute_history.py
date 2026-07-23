from __future__ import annotations

from typing import Literal, cast

import pandas as pd

from ocelescope import OCEL
from ocelescope.ocel.constants import EID_COL, OID_COL, TIMESTAMP_COL
from ocelescope_module_ocel.util.attributes import attribute_names

from ocelescope_module_exploration.errors import InvalidAnalysisQuery

INITIAL_TIMESTAMP = pd.Timestamp("1970-01-01", tz="UTC")

EntriesToInclude = Literal["all_events", "active_events", "active"]


def _resolve_attributes(
    ocel: OCEL, object_id: str, attributes: list[str] | None
) -> list[str]:
    object_row = ocel.objects.df.loc[ocel.objects.df[OID_COL].eq(object_id)]
    if object_row.empty:
        raise InvalidAnalysisQuery(f"Unknown object '{object_id}'")
    if attributes is not None:
        return attributes
    object_type = str(ocel.objects.type_by_id[object_id])
    return attribute_names(ocel, "objects", entity_names=[object_type])


def _change_timeline(ocel: OCEL, object_id: str, attributes: list[str]) -> pd.DataFrame:
    """The 1970 baseline plus every timestamp at which an attribute changed."""
    object_row = ocel.objects.df.loc[ocel.objects.df[OID_COL].eq(object_id)].iloc[0]
    dynamic_cols = [a for a in attributes if a in ocel.objects.dynamic_attribute_names]
    static_cols = [a for a in attributes if a not in dynamic_cols]

    initial_row = pd.DataFrame([object_row[attributes]])
    initial_row.index = pd.DatetimeIndex([INITIAL_TIMESTAMP], name=TIMESTAMP_COL)

    if dynamic_cols:
        changes = ocel.objects.object_attr_changes(
            objects=[object_id], attributes=dynamic_cols
        )
        dynamic_timeline = (
            changes.xs(object_id, level=OID_COL)[dynamic_cols]
            if not changes.empty
            and object_id in changes.index.get_level_values(OID_COL)
            else pd.DataFrame(
                columns=dynamic_cols, index=pd.DatetimeIndex([], name=TIMESTAMP_COL)
            )
        )
    else:
        dynamic_timeline = pd.DataFrame(index=pd.DatetimeIndex([], name=TIMESTAMP_COL))

    timeline = pd.concat([initial_row, dynamic_timeline]).sort_index(kind="stable")
    if dynamic_cols:
        timeline[dynamic_cols] = timeline[dynamic_cols].ffill()
    for column in static_cols:
        timeline[column] = object_row[column]
    # Collapse any accidental same-timestamp duplicates (e.g. a real change at 1970),
    # keeping the most complete (last, already-filled) row per timestamp.
    return cast(pd.DataFrame, timeline[attributes].groupby(level=0).last())


def get_object_attribute_value_development(
    ocel: OCEL,
    object_id: str,
    attributes: list[str] | None = None,
    entries_to_include: EntriesToInclude = "active",
) -> pd.DataFrame:
    """The value of every attribute of one object, over its whole lifetime.

    Treats the objects table the same as an object_changes entry at the 1970-01-01
    sentinel timestamp: the first row is always 1970, and every attribute column is
    forward-filled from there. ``entries_to_include`` controls which extra rows (beyond
    the timestamps where an attribute actually changed) are added:

    - "active": no extra rows -- indexed by timestamp only.
    - "active_events": also one row per event this object participates in.
    - "all_events": also one row per event in the whole log.

    Extra rows are indexed by (timestamp, event id) and carry the attribute values in
    effect at that point (backward as-of lookup against the change timeline); change
    rows have a missing event id. Rows are ordered by timestamp ascending, then changes
    before events, then events alphabetically by id, at each timestamp.
    """
    resolved_attributes = _resolve_attributes(ocel, object_id, attributes)
    if not resolved_attributes:
        index = (
            pd.DatetimeIndex([], name=TIMESTAMP_COL)
            if entries_to_include == "active"
            else pd.MultiIndex.from_arrays([[], []], names=[TIMESTAMP_COL, EID_COL])
        )
        return pd.DataFrame(index=index)

    timeline = _change_timeline(ocel, object_id, resolved_attributes)
    if entries_to_include == "active":
        return timeline

    if entries_to_include == "active_events":
        event_ids = ocel.e2o.df.loc[
            ocel.e2o.df[OID_COL].eq(object_id), EID_COL
        ].unique()
        events = ocel.events.df.loc[
            ocel.events.df[EID_COL].isin(event_ids), [EID_COL, TIMESTAMP_COL]
        ]
    elif entries_to_include == "all_events":
        events = ocel.events.df.loc[:, [EID_COL, TIMESTAMP_COL]]
    else:
        raise ValueError(f"Unknown entries_to_include '{entries_to_include}'")

    events = events.copy()
    events[TIMESTAMP_COL] = pd.to_datetime(
        events[TIMESTAMP_COL], errors="coerce", utc=True
    )
    events = events.dropna(subset=[TIMESTAMP_COL]).sort_values(
        TIMESTAMP_COL, kind="stable"
    )

    event_values = pd.merge_asof(
        events,
        timeline.reset_index().sort_values(TIMESTAMP_COL, kind="stable"),
        on=TIMESTAMP_COL,
        direction="backward",
        allow_exact_matches=True,
    )

    change_rows = timeline.reset_index()
    change_rows[EID_COL] = pd.NA

    combined = pd.concat([change_rows, event_values], ignore_index=True)
    combined["_is_event"] = combined[EID_COL].notna()
    combined = combined.sort_values(
        [TIMESTAMP_COL, "_is_event", EID_COL], kind="stable"
    ).drop(columns="_is_event")
    return combined.set_index([TIMESTAMP_COL, EID_COL])[resolved_attributes]


def get_object_attribute_values_at(
    ocel: OCEL,
    object_id: str,
    event_id_or_timestamp: str | pd.Timestamp,
    attributes: list[str] | None = None,
) -> dict[str, object]:
    """The state of every attribute of one object as of an event or timestamp."""
    if isinstance(event_id_or_timestamp, str):
        event_row = ocel.events.df.loc[
            ocel.events.df[EID_COL].eq(event_id_or_timestamp)
        ]
        if event_row.empty:
            raise InvalidAnalysisQuery(f"Unknown event '{event_id_or_timestamp}'")
        target = pd.to_datetime(
            event_row.iloc[0][TIMESTAMP_COL], errors="coerce", utc=True
        )
    else:
        target = pd.to_datetime(event_id_or_timestamp, errors="coerce", utc=True)
    if pd.isna(target):
        raise InvalidAnalysisQuery("Could not resolve a target timestamp")

    timeline = get_object_attribute_value_development(
        ocel, object_id, attributes, entries_to_include="active"
    )
    eligible = timeline.loc[timeline.index <= target]
    if eligible.empty:
        raise InvalidAnalysisQuery(f"No attribute state exists at or before {target}")
    return cast(dict, eligible.iloc[-1].to_dict())
