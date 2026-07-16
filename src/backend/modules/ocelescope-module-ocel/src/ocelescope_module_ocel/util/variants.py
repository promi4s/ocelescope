"""Object variants (activity-sequence per object).

A thin adapter over the OCEL's executions manager, which does the grouping in
DuckDB; this only shapes the result into the API models.

The variant id is the manager's ``<object_type>_<hash of the activity
sequence>``, so it depends only on the sequence itself. That is what lets the
``objectVariants`` endpoint and the variant XES export share it: the ids the
export accepts are exactly the ones the endpoint hands out, and they survive the
log being filtered -- which an index into a frequency ranking would not, since
every id there shifts as soon as the ranking does.
"""

from __future__ import annotations

from ocelescope.ocel.constants.executions import (
    VARIANT_ACT_LIST_COL,
    VARIANT_FREQUENCY_COL,
)

from ocelescope import OCEL
from ocelescope_module_ocel.models import ObjectTypeVariants, ObjectVariant


def object_type_variants(ocel: OCEL, object_type: str) -> ObjectTypeVariants:
    """Every distinct activity sequence the objects of ``object_type`` follow.

    Ordered by descending case count, as the model documents.
    """
    frame = ocel.executions.get_object_variants([object_type])
    variants = [
        ObjectVariant(
            variant_id=str(variant_id),
            activities=list(activities),
            event_count=len(activities),
            case_count=int(case_count),
        )
        for variant_id, activities, case_count in zip(
            frame.index, frame[VARIANT_ACT_LIST_COL], frame[VARIANT_FREQUENCY_COL]
        )
    ]
    return ObjectTypeVariants(
        variants=variants,
        case_count=sum(variant.case_count for variant in variants),
        event_count=sum(
            variant.event_count * variant.case_count for variant in variants
        ),
    )
