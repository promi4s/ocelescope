import pm4py

from ocelescope import OCEL
from ocelescope.discovery.algorithm import FilteredDiscoveryParameters
from ocelescope.discovery.decorator import discovery_method
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
    filtered_ocel = ocel.filter(parameters.build_filter_pipeline())
    return DirectlyFollowsGraph.from_pm4py(pm4py.discover_ocdfg(filtered_ocel.ocel))
