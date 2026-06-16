from typing import Annotated, Literal

from ocelescope_backend.app.modules import ModuleFilter
from pydantic import Field

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


class NativeE2OCountFilter(NativeFilterBase, E2OCountFilter):
    type: Literal["e2o_count"]


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
