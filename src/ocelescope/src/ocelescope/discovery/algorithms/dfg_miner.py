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
            description="Precentage of edges too keep (1 = keep all). Frquency Values of edges are determined with respect to the absolute count of their object types.",
        ),
    ] = 1,
) -> DirectlyFollowsGraph:
    dfg = DirectlyFollowsGraph.from_pm4py(pm4py.discover_ocdfg(ocel.ocel))
    return dfg.filter_edges(1 - frequency_threshold)
