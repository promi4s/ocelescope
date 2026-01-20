from ocelescope import (
    BaseFilter,
    E2OCountFilter,
    EventAttributeFilter,
    EventTypeFilter,
    O2OCountFilter,
    ObjectAttributeFilter,
    ObjectTypeFilter,
    TimeFrameFilter,
)

from app.internal.model.ocel import OCELFilter


# TODO: Delete this file
# IF someone reads this i know this is ugly but i want to clean this up anyway
def merge_filters(pipeline: list[BaseFilter]) -> OCELFilter:
    ocel_filter: OCELFilter = {}

    for filter in pipeline:
        if isinstance(filter, EventTypeFilter):
            ocel_filter["event_type"] = filter
        elif isinstance(filter, ObjectTypeFilter):
            ocel_filter["object_types"] = filter
        elif isinstance(filter, EventAttributeFilter):
            ocel_filter["event_attributes"] = ocel_filter.get(
                "event_attributes", []
            ) + [filter]
        elif isinstance(filter, ObjectAttributeFilter):
            ocel_filter["object_attributes"] = ocel_filter.get(
                "object_attributes", []
            ) + [filter]
        elif isinstance(filter, O2OCountFilter):
            ocel_filter["o2o_count"] = ocel_filter.get("o2o", []) + [filter]
        elif isinstance(filter, E2OCountFilter):
            ocel_filter["e2o_count"] = ocel_filter.get("e2o", []) + [filter]
        elif isinstance(filter, TimeFrameFilter):
            ocel_filter["time_range"] = filter

    return ocel_filter


def unmerge_filter(ocel_filter: OCELFilter) -> list[BaseFilter]:
    result = []
    for value in ocel_filter.values():
        if isinstance(value, list):
            result.extend(value)
        else:
            result.append(value)
    return result
