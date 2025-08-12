from typing import Optional, cast, TYPE_CHECKING

import pandas as pd
import pm4py


from ocelescope.ocel.filter.base import BaseFilter, FilterResult

from ocelescope.ocel.filter.filters import OCELFilter

if TYPE_CHECKING:
    from ocelescope.ocel.ocel import OCEL


def compute_combined_masks(ocel: "OCEL", filters: OCELFilter) -> FilterResult:
    combined = FilterResult(
        events=pd.Series(True, index=ocel.events.index),
        objects=pd.Series(True, index=ocel.objects.index),
    )

    for filter in filters.values():
        filter_list = cast(list[BaseFilter], filter if isinstance(filter, list) else [filter])

        for filter in filter_list:
            combined = combined.and_merge(filter.filter(ocel))

    return combined


def apply_filters(ocel: "OCEL", filters: OCELFilter) -> "OCEL":
    from ..ocel import OCEL

    masks = compute_combined_masks(ocel, filters)

    filtered_event_ids: Optional[pd.Series] = (
        cast(pd.Series, ocel.events[ocel.ocel.event_id_column][masks.events])
        if masks.events is not None
        else None
    )

    filtered_object_ids: Optional[pd.Series] = (
        cast(pd.Series, ocel.objects[ocel.ocel.object_id_column][masks.objects])
        if masks.objects is not None
        else None
    )

    filtered_ocel = ocel.ocel

    if filtered_event_ids is not None:
        filtered_ocel = pm4py.filter_ocel_events(filtered_ocel, filtered_event_ids, positive=True)

    if filtered_object_ids is not None:
        filtered_ocel = pm4py.filter_ocel_objects(filtered_ocel, filtered_object_ids, positive=True)

    return OCEL(filtered_ocel, ocel.id)
