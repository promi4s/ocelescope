from typing import Annotated, ClassVar

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
    NativeFilterType = ClassVar[str]


class NativeE2OCountFilter(NativeFilterBase, E2OCountFilter):
    type = "e2o_count"


class NativeO2OCountFilter(NativeFilterBase, O2OCountFilter):
    type = "o2o_count"


class NativeActivityFilter(NativeFilterBase, EventTypeFilter):
    type = "activity"


class NativeObjectTypeFilter(NativeFilterBase, ObjectTypeFilter):
    type = "object_type"


class NativeEventAttributeFilter(NativeFilterBase, EventAttributeFilter):
    type = "event_attributes"


class NativeObjectAttributeFilter(NativeFilterBase, ObjectAttributeFilter):
    type = "object_attribute"


class NativeTimeFrameFilter(NativeFilterBase, TimeFrameFilter):
    type = "time_frame"


NativeFilter = Annotated[
    NativeE2OCountFilter
    | NativeO2OCountFilter
    | NativeActivityFilter
    | NativeObjectTypeFilter
    | NativeEventAttributeFilter
    | NativeObjectAttributeFilter
    | NativeTimeFrameFilter,
    Field(discriminator="type"),
]
