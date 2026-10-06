from typing import Self

from pydantic import BaseModel

from ocelescope import OCEL, QEL


class QuantityInfo(BaseModel):
    item_types: list[str]
    total_object_count: int
    total_event_count: int
    object_types: list[str]
    activities: list[str]

    @classmethod
    def from_ocel(cls, ocel: OCEL) -> Self:
        quantities = QEL.from_ocel(ocel).quantities
        return cls(
            item_types=quantities.item_types,
            total_object_count=len(quantities.objects),
            total_event_count=len(quantities.events),
            object_types=quantities.object_types,
            activities=quantities.activities,
        )
