from __future__ import annotations

from typing import Annotated, Literal, TypeAlias

from ocelescope.ocel.filter import (
    E2OCountFilter as _E2OCountFilter,
)
from ocelescope.ocel.filter import (
    EventTypeFilter as _EventTypeFilter,
)
from ocelescope.ocel.filter import (
    O2OCountFilter as _O2OCountFilter,
)
from ocelescope.ocel.filter import (
    ObjectTypeFilter as _ObjectTypeFilter,
)
from ocelescope.ocel.filter import (
    TimeFrameFilter as _TimeFrameFilter,
)
from pydantic import Field

from ocelescope_module_filter.filters.attribute import (
    EventAttributeFilter,
    ObjectAttributeFilter,
)
from ocelescope_module_filter.filters.e2o_object import E2OObjectFilter

FILTER_SOURCE = "FilterV1"


Mode = Literal["include", "exclude"]


class TimeFrameFilter(_TimeFrameFilter):
    """Keep (or exclude) events whose timestamp falls in ``[start, end]``."""

    type: Literal["time_frame"]


class ActivityFilter(_EventTypeFilter):
    """Keep (or exclude) events of the given activities."""

    type: Literal["activity"]
    mode: Mode = "include"


class ObjectTypeFilter(_ObjectTypeFilter):
    """Keep (or exclude) objects of the given object types."""

    type: Literal["object_type"]
    mode: Mode = "include"


class E2OCountFilter(_E2OCountFilter):
    """Keep events/objects by how many E2O relations of a given kind they have."""

    type: Literal["e2o_count"]


class O2OCountFilter(_O2OCountFilter):
    """Keep objects by how many O2O relations of a given kind they have."""

    type: Literal["o2o_count"]


NativeFilter: TypeAlias = Annotated[
    TimeFrameFilter
    | ActivityFilter
    | ObjectTypeFilter
    | EventAttributeFilter
    | ObjectAttributeFilter
    | E2OCountFilter
    | E2OObjectFilter
    | O2OCountFilter,
    Field(discriminator="type"),
]
