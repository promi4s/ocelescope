from typing import TypedDict

from ocelescope import (
    OCEL,
    BaseFilter,
    E2OCountFilter,
    EventAttributeFilter,
    EventTypeFilter,
    O2OCountFilter,
    ObjectAttributeFilter,
    ObjectTypeFilter,
    TimeFrameFilter,
)
from pydantic.main import BaseModel

from app.internal.registry.extension import OCELExtensionDescription


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]


class UploadingOcelMetadata(BaseModel):
    task_id: str


class OcelListResponse(BaseModel):
    ocels: list[OcelMetadata]


# TODO: Remove this concept completly
class OCELFilter(TypedDict, total=False):
    object_types: ObjectTypeFilter
    event_type: EventTypeFilter
    time_range: TimeFrameFilter
    o2o_count: list[O2OCountFilter]
    e2o_count: list[E2OCountFilter]
    event_attributes: list[EventAttributeFilter]
    object_attributes: list[ObjectAttributeFilter]


class SessionOCEL:
    def __init__(self, ocel: OCEL):
        self.origin: OCEL = ocel
        self.applied_filter: list[BaseFilter] = []
        self._filtered_ocel: OCEL = ocel

    @property
    def ocel(self):
        return self._filtered_ocel

    def apply_filter(self, pipeline: list[BaseFilter]):
        self.applied_filter = pipeline
        self._filtered_ocel = (
            self.origin.filter(self.applied_filter)
            if len(self.applied_filter) >= 0
            else self.origin
        )
