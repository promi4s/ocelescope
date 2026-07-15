"""Filters: a valid subset of an OCEL, expressed as the ids to keep.

Each filter answers one question -- which event/object ids do you keep? -- as a
:class:`Keep` of lazy polars frames, and :func:`apply_filters` runs a whole
pipeline in one pass: intersect the ids, then let DuckDB build the filtered log.
See :mod:`.base` for the contract and :mod:`.engine` for the applier.
"""

from ocelescope.ocel.filter.base import BaseFilter, Keep
from ocelescope.ocel.filter.engine import apply_filters
from ocelescope.ocel.filter.filters.attribute import EventAttributeFilter, ObjectAttributeFilter
from ocelescope.ocel.filter.filters.entity_type import (
    EventTypeFilter,
    ObjectIdFilter,
    ObjectTypeFilter,
)
from ocelescope.ocel.filter.filters.frequency import (
    EventTypeFrequencyFilter,
    ObjectTypeFrequencyFilter,
)
from ocelescope.ocel.filter.filters.relation_count import E2OCountFilter, O2OCountFilter
from ocelescope.ocel.filter.filters.time_range import TimeFrameFilter

__all__ = [
    "BaseFilter",
    "E2OCountFilter",
    "EventAttributeFilter",
    "EventTypeFilter",
    "EventTypeFrequencyFilter",
    "Keep",
    "O2OCountFilter",
    "ObjectAttributeFilter",
    "ObjectIdFilter",
    "ObjectTypeFilter",
    "ObjectTypeFrequencyFilter",
    "TimeFrameFilter",
    "apply_filters",
]
