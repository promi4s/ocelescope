"""The analyses. Adding one is a query model with a `run(log)` method in the
matching family module, plus an entry in `Query`."""

from __future__ import annotations

from ocelescope_module_exploration.analyses.distributions import (
    EventAttributeDistribution,
    ObjectAttributeDistribution,
    ObjectInvolvementDistribution,
    TimeBetweenActivities,
)
from ocelescope_module_exploration.analyses.frequencies import (
    ActivityExecutionFrequency,
    ObjectActivityExecutionDistribution,
    ObjectCountsPerEvent,
    ObjectTypeCombinations,
    TotalObjectInvolvement,
)
from ocelescope_module_exploration.analyses.timeline import ObjectAttributeTimeline

#: The request body, told apart by its `analysis` field.
Query = (
    EventAttributeDistribution
    | ObjectAttributeDistribution
    | ObjectInvolvementDistribution
    | TimeBetweenActivities
    | TotalObjectInvolvement
    | ObjectCountsPerEvent
    | ObjectTypeCombinations
    | ActivityExecutionFrequency
    | ObjectActivityExecutionDistribution
    | ObjectAttributeTimeline
)
