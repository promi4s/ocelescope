import itertools
from typing import Annotated, ClassVar, Literal, Self

from ocelescope_backend.app.modules import ModuleFilter
from pydantic import BaseModel, Field

from ocelescope import (
    E2OCountFilter,
    EventAttributeFilter,
    EventTypeFilter,
    O2OCountFilter,
    ObjectAttributeFilter,
    ObjectTypeFilter,
    TimeFrameFilter,
)


class NativeFilterBase(ModuleFilter):
    OcelescopeModuleSource = "FilterV1"
    NativeFilterType: ClassVar[str]


class NativeE2OCountFilter(NativeFilterBase, E2OCountFilter):
    type: Literal["e2o_count"] = "e2o_count"


class NativeO2OCountFilter(NativeFilterBase, O2OCountFilter):
    type: Literal["o2o_count"]


class NativeActivityFilter(NativeFilterBase, EventTypeFilter):
    type: Literal["activity"]


class NativeObjectTypeFilter(NativeFilterBase, ObjectTypeFilter):
    type: Literal["object_type"]


class NativeEventAttributeFilter(NativeFilterBase, EventAttributeFilter):
    type: Literal["event_attribute"]


class NativeObjectAttributeFilter(NativeFilterBase, ObjectAttributeFilter):
    type: Literal["object_attribute"]


class NativeTimeFrameFilter(NativeFilterBase, TimeFrameFilter):
    type: Literal["time_frame"]


NativeFilter = Annotated[
    NativeActivityFilter
    | NativeObjectTypeFilter
    | NativeTimeFrameFilter
    | NativeEventAttributeFilter
    | NativeObjectAttributeFilter
    | NativeE2OCountFilter
    | NativeO2OCountFilter,
    Field(discriminator="type"),
]


class GroupedOCELFilter(BaseModel):
    activity: NativeActivityFilter | None = Field(default=None)
    object_type: NativeObjectTypeFilter | None = Field(default=None)
    time_frame: NativeTimeFrameFilter | None = Field(default=None)
    event_attribute: list[NativeEventAttributeFilter] = Field(default_factory=list)
    object_attribute: list[NativeObjectAttributeFilter] = Field(default_factory=list)
    e2o_count: list[NativeE2OCountFilter] = Field(default_factory=list)
    o2o_count: list[NativeO2OCountFilter] = Field(default_factory=list)

    @classmethod
    def from_pipeline(cls, pipeline: list[NativeFilter]) -> Self:
        grouped_filters = cls()

        for filter in pipeline:
            aggr_field = getattr(grouped_filters, filter.type)
            if isinstance(aggr_field, list):
                aggr_field.append(filter)
            else:
                setattr(grouped_filters, filter.type, filter)

        return grouped_filters

    def to_pipeline(self) -> list[NativeFilter]:
        return list(
            itertools.chain.from_iterable(
                native_filter for native_filter in self.model_dump().values()
            )
        )
