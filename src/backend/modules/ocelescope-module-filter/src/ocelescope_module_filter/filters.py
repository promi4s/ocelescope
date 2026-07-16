"""The concrete ``FilterV1`` filters this module pushes.

Each is one of ocelescope's filters plus the ``type`` discriminator the API needs
to serialize a pipeline and read it back. The filtering itself -- what each keeps,
and how -- belongs to the library, so there is nothing to restate here: these
classes exist to name the library's filters over the wire.

The module's own default is to *include* what a filter names, where the library
leaves that open, so the two entity-type filters say so.
"""

from __future__ import annotations

from typing import Literal

from ocelescope.ocel.filter import (
    E2OCountFilter as _E2OCountFilter,
)
from ocelescope.ocel.filter import (
    EventAttributeFilter as _EventAttributeFilter,
)
from ocelescope.ocel.filter import (
    EventTypeFilter as _EventTypeFilter,
)
from ocelescope.ocel.filter import (
    O2OCountFilter as _O2OCountFilter,
)
from ocelescope.ocel.filter import (
    ObjectAttributeFilter as _ObjectAttributeFilter,
)
from ocelescope.ocel.filter import (
    ObjectTypeFilter as _ObjectTypeFilter,
)
from ocelescope.ocel.filter import (
    TimeFrameFilter as _TimeFrameFilter,
)

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


class EventAttributeFilter(_EventAttributeFilter):
    """Keep events whose attribute matches; activities without it are untouched."""

    type: Literal["event_attribute"]


class ObjectAttributeFilter(_ObjectAttributeFilter):
    """Keep objects whose (static) attribute matches; types without it are untouched."""

    type: Literal["object_attribute"]


class E2OCountFilter(_E2OCountFilter):
    """Keep events/objects by how many E2O relations of a given kind they have."""

    type: Literal["e2o_count"]


class O2OCountFilter(_O2OCountFilter):
    """Keep objects by how many O2O relations of a given kind they have."""

    type: Literal["o2o_count"]
