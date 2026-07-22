from typing import Self

from ocelescope import OCEL
from pydantic import BaseModel


class QuantityInfo(BaseModel):
    item_types: list[str]
    total_object_count: int
    total_event_count: int
    object_types: list[str]
    activities: list[str]

    @classmethod
    def from_ocel(cls, ocel: OCEL) -> Self:
        return cls(
            item_types=ocel.quantities.item_types,
            total_object_count=len(ocel.quantities.objects),
            total_event_count=len(ocel.quantities.events),
            object_types=ocel.quantities.object_types,
            activities=ocel.quantities.activities,
        )
