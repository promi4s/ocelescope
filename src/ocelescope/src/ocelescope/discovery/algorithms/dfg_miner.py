import pm4py

from ocelescope import OCEL
from ocelescope.discovery.algorithm import FilteredDiscoveryParameters
from ocelescope.discovery.decorator import discovery_method
from ocelescope.ocel.filter.filters.entity_type import EventTypeFilter, ObjectTypeFilter
from ocelescope.ocel.filter.filters.frequency import (
    EventTypeFrequencyFilter,
    ObjectTypeFrequencyFilter,
)
from ocelescope.resource.default.dfg import DirectlyFollowsGraph


class OCDFGMiner(FilteredDiscoveryParameters):
    pass


@discovery_method(
    name="Object-Centric DFG",
    description="Discover an object-centric directly-follows graph.",
)
def ocdfg_miner(
    ocel: OCEL,
    parameters: OCDFGMiner,
) -> DirectlyFollowsGraph:
    filter_pipeline = [
        EventTypeFilter(event_types=parameters.excluded_event_types, mode="exclude"),
        ObjectTypeFilter(object_types=parameters.excluded_object_types, mode="exclude"),
        EventTypeFrequencyFilter(threshold_percentage=parameters.activity_frequency_threshold),
        ObjectTypeFrequencyFilter(threshold_percentage=parameters.object_frequency_threshold),
    ]

    filtered_ocel = ocel.filter(filter_pipeline)
    return DirectlyFollowsGraph.from_pm4py(pm4py.discover_ocdfg(filtered_ocel.ocel))
