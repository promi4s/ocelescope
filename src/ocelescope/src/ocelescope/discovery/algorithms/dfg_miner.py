from typing import Annotated

import pm4py
from pydantic import Field

from ocelescope import OCEL
from ocelescope.discovery.decorator import discovery_method
from ocelescope.resource.default.dfg import DirectlyFollowsGraph


@discovery_method(
    name="Object-Centric DFG",
    description="Discover an object-centric directly-follows graph.",
)
def ocdfg_miner(
    ocel: OCEL,
    frequency_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
            title="Frequency Threshold",
            description="Edges whose count is below this fraction of their object type's total count are removed. 0 = show all edges.",
        ),
    ] = 0,
) -> DirectlyFollowsGraph:
    dfg = DirectlyFollowsGraph.from_pm4py(pm4py.discover_ocdfg(ocel.ocel))
    return dfg.filter_edges(frequency_threshold)
