from typing import Annotated, Literal

import pm4py

from ocelescope import OCEL
from ocelescope.discovery.algorithm import select_field
from ocelescope.discovery.decorator import discovery_method
from ocelescope.resource.default.petri_net import PetriNet


@discovery_method(
    name="Inductive Miner",
    description="Discover an object-centric Petri net with the inductive miner.",
)
def inductive_miner(
    ocel: OCEL,
    variant: Annotated[
        Literal["im", "imd"],
        select_field(
            title="Mining Variant",
            description="Choose the inductive mining variant used for discovery.",
            options={"im": "IM (traditional)", "imd": "IMd (directly-follows)"},
        ),
    ] = "im",
) -> PetriNet:
    ocpn = pm4py.discover_oc_petri_net(
        inductive_miner_variant=variant,
        ocel=ocel.ocel,
    )
    return PetriNet.from_pm4py(ocpn)
