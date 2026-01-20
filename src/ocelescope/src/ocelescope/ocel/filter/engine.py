from typing import TYPE_CHECKING, Optional, cast

import pandas as pd
import pm4py

from ocelescope.ocel.constants.pm4py import OID_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


def compute_combined_masks(ocel: "OCEL", filters: list[BaseFilter]) -> FilterResult:
    combined = FilterResult(
        events=pd.Series(True, index=ocel.events.df.index),
        objects=pd.Series(True, index=ocel.objects.df.index),
    )

    for filter in filters:
        combined = combined.and_merge(filter.filter(ocel))

    return combined


def apply_filters(ocel: "OCEL", filters: list[BaseFilter]) -> "OCEL":
    from ocelescope.ocel.core.ocel import OCEL

    masks = compute_combined_masks(ocel, filters)

    filtered_event_ids: Optional[pd.Series] = (
        cast(pd.Series, ocel.events.df[ocel.ocel.event_id_column][masks.events])
        if masks.events is not None
        else None
    )

    filtered_object_ids: Optional[pd.Series] = (
        cast(pd.Series, ocel.objects.df[OID_COL][masks.objects])
        if masks.objects is not None
        else None
    )

    filtered_ocel = ocel.ocel

    if filtered_event_ids is not None:
        filtered_ocel = pm4py.filter_ocel_events(filtered_ocel, filtered_event_ids, positive=True)

    if filtered_object_ids is not None:
        filtered_ocel = pm4py.filter_ocel_objects(filtered_ocel, filtered_object_ids, positive=True)

    # TODO: Don't do this step
    filtered_ocel = OCEL(filtered_ocel, ocel.meta)
    filtered_ocel.meta = ocel.meta

    return filtered_ocel
