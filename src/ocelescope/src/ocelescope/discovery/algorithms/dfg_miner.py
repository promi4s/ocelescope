import pm4py

from ocelescope import OCEL
from ocelescope.discovery.decorator import discovery_method
from ocelescope.resource.default.dfg import DirectlyFollowsGraph


@discovery_method(
    name="Object-Centric DFG",
    description="Discover an object-centric directly-follows graph.",
)
def ocdfg_miner(ocel: OCEL) -> DirectlyFollowsGraph:
    return DirectlyFollowsGraph.from_pm4py(pm4py.discover_ocdfg(ocel.ocel))
