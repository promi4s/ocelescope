from typing import TypedDict


from ocelescope.ocel.filter.filters.attribute import EventAttributeFilter, ObjectAttributeFilter
from ocelescope.ocel.filter.filters.entity_type import (
    EventTypeFilter,
    ObjectTypeFilter,
)
from ocelescope.ocel.filter.filters.relation_count import E2OCountFilter, O2OCountFilter
from ocelescope.ocel.filter.filters.time_range import TimeFrameFilter


class OCELFilter(TypedDict, total=False):
    object_types: ObjectTypeFilter
    event_type: EventTypeFilter
    time_range: TimeFrameFilter
    o2o_count: list[O2OCountFilter]
    e2o_count: list[E2OCountFilter]
    event_attributes: list[EventAttributeFilter]
    object_attributes: list[ObjectAttributeFilter]


__all__ = [
    "OCELFilter",
    "ObjectTypeFilter",
    "EventTypeFilter",
    "ObjectAttributeFilter",
    "EventAttributeFilter",
    "O2OCountFilter",
    "E2OCountFilter",
    "TimeFrameFilter",
]
