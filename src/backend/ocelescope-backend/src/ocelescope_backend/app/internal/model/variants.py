from typing import Self, cast

import pandas as pd
from pydantic import BaseModel

from ocelescope.ocel.constants.executions import (
    VARIANT_ACT_LIST_COL,
    VARIANT_FREQUENCY_COL,
)


class ObjectVariant(BaseModel):
    """
    A single object variant: a distinct sequence of activities that objects of a
    given object type go through.

    Attributes:
        variant_id: Identifier of the variant (``<object_type>_<hash>``).
        activities: The ordered activity sequence that defines the variant.
        event_count: Number of events in the variant (length of ``activities``).
        case_count: Number of objects (cases) that follow this variant.
    """

    variant_id: str
    activities: list[str]
    event_count: int
    case_count: int


class ObjectTypeVariants(BaseModel):
    """
    All variants of a single object type together with the totals across them.

    Attributes:
        variants: The distinct variants, sorted by frequency (descending).
        case_count: Total number of cases (objects) of the object type.
        event_count: Total number of events across all cases of the object type.
    """

    variants: list[ObjectVariant]
    case_count: int
    event_count: int

    @classmethod
    def from_variants(cls, variants: pd.DataFrame) -> Self:
        """Build the response from a variant DataFrame (as returned by
        ``ExecutionsManager.get_object_variants``).

        The variant id is read from the index; the activity list and frequency
        are read from their canonical columns. The totals are aggregated across
        every variant.
        """
        object_variants = [
            ObjectVariant(
                variant_id=str(variant_id),
                activities=list(row[VARIANT_ACT_LIST_COL]),
                event_count=len(row[VARIANT_ACT_LIST_COL]),
                case_count=cast(int, row[VARIANT_FREQUENCY_COL]),
            )
            for variant_id, row in variants.iterrows()
        ]

        return cls(
            variants=object_variants,
            case_count=sum(variant.case_count for variant in object_variants),
            event_count=sum(
                variant.event_count * variant.case_count
                for variant in object_variants
            ),
        )
