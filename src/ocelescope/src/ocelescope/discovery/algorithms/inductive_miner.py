import pm4py
from typing_extensions import Literal

from ocelescope import OCEL
from ocelescope.discovery.algorithm import FilteredDiscoveryParameters, select_field
from ocelescope.discovery.decorator import discovery_method
from ocelescope.resource.default.petri_net import PetriNet


class InductiveMinerParameters(FilteredDiscoveryParameters):
    variant: Literal["im", "imd"] = select_field(
        default="im",
        title="Mining Variant",
        description="Choose the inductive mining variant used for discovery.",
        options={"im": "IM (traditional)", "imd": "IMd (directly-follows)"},
    )


@discovery_method(
    name="Inductive Miner",
    description="Discover an object-centric Petri net with the inductive miner.",
)
def inductive_miner(
    ocel: OCEL,
    parameters: InductiveMinerParameters,
) -> PetriNet:
    filtered_ocel = ocel.filter(parameters.build_filter_pipeline())
    ocpn = pm4py.discover_oc_petri_net(
        inductive_miner_variant=parameters.variant,
        ocel=filtered_ocel.ocel,
    )
    return PetriNet.from_pm4py(ocpn)
