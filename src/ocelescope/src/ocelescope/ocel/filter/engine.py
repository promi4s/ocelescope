from typing import TYPE_CHECKING, Sequence

import pandas as pd

from ocelescope.ocel.filter.base import BaseFilter, FilterResult
from ocelescope.ocel.util.cleanup import clean_ocel

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


def compute_combined_masks(ocel: "OCEL", filters: Sequence[BaseFilter]) -> FilterResult:
    combined = FilterResult(
        events=pd.Series(True, index=ocel.events.df.index),
        objects=pd.Series(True, index=ocel.objects.df.index),
    )

    for filter in filters:
        combined = combined.and_merge(filter.filter(ocel))

    return combined


def apply_filters(ocel: "OCEL", filters: Sequence[BaseFilter]) -> "OCEL":
    from ocelescope.ocel.core.ocel import OCEL

    masks = compute_combined_masks(ocel, filters)

    events_df = ocel.events.df
    if masks.events is not None:
        events_df = events_df.loc[masks.events]

    objects_df = ocel.objects.df
    if masks.objects is not None:
        objects_df = objects_df.loc[masks.objects]

    cleaned = clean_ocel(
        {
            "events": events_df,
            "objects": objects_df,
            "relations": ocel._relations,
            "o2o": ocel._o2o,
            "object_changes": ocel._object_changes,
        }
    )

    return OCEL(
        events=cleaned["events"],
        objects=cleaned["objects"],
        relations=cleaned["relations"],
        o2o=cleaned["o2o"],
        object_changes=cleaned["object_changes"],
        meta=ocel.meta,
        quantityExtension=(
            ocel.quantities.oqty,
            ocel.quantities.qop,
            ocel.quantities.properties,
        )
        if ocel.quantities.is_populated()
        else None,
    )
