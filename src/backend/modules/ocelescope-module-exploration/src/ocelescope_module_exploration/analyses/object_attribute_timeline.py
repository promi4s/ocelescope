from __future__ import annotations

from datetime import datetime
from typing import cast

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, EID_COL

from ocelescope_module_exploration.shared.object_attribute_history import (
    get_object_attribute_value_development,
)


class ObjectAttributeTimelineQuery(BaseModel):
    object_id: str
    attributes: list[str] | None = None


class ObjectAttributeTimelinePoint(BaseModel):
    timestamp: datetime
    event_id: str | None = None
    activity: str | None = None


class ObjectAttributeTimelineResponse(BaseModel):
    object_type: str
    points: list[ObjectAttributeTimelinePoint]
    series: dict[str, list[str | int | float | bool | None]]


def execute_object_attribute_timeline_query(
    ocel: OCEL,
    query: ObjectAttributeTimelineQuery,
) -> ObjectAttributeTimelineResponse:
    timeline = get_object_attribute_value_development(
        ocel,
        query.object_id,
        query.attributes,
        entries_to_include="active_events",
    )

    activity_by_event = ocel.events.df.set_index(EID_COL)[ACTIVITY_COL]
    points: list[ObjectAttributeTimelinePoint] = []
    for timestamp, event_id in timeline.index:
        has_event = isinstance(event_id, str) or (
            event_id is not None and not pd.isna(event_id)
        )
        points.append(
            ObjectAttributeTimelinePoint(
                timestamp=timestamp,
                event_id=str(event_id) if has_event else None,
                activity=str(activity_by_event[event_id]) if has_event else None,
            )
        )

    def coerce(value: object) -> str | int | float | bool | None:
        if pd.isna(value):
            return None
        if isinstance(value, (pd.Timestamp, datetime)):
            return value.isoformat()
        return cast("str | int | float | bool", value)

    series = {
        column: [coerce(value) for value in timeline[column]]
        for column in timeline.columns
    }

    object_type = str(ocel.objects.type_by_id[query.object_id])
    return ObjectAttributeTimelineResponse(
        object_type=object_type, points=points, series=series
    )
