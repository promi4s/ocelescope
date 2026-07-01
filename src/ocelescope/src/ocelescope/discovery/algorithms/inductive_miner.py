from typing import Annotated

import pm4py
from pydantic import Field

from ocelescope import OCEL
from ocelescope.discovery.decorator import discovery_method
from ocelescope.resource.default.petri_net import PetriNet


@discovery_method(
    name="Inductive Miner (flattening)",
    description="Discover an object-centric Petri net with the inductive miner.",
)
def inductive_miner(
    ocel: OCEL,
    noise_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
            title="Noise Threshold",
            description="Fraction of infrequent behaviour to filter out (0 = no filtering, IMf variant).",
        ),
    ] = 0,
) -> PetriNet:
    ocpn = pm4py.discover_oc_petri_net(
        ocel=ocel.ocel,
        noise_threshold=noise_threshold,
        disable_fallthroughs=False,
        disable_strict_sequence_cut=False,
    )
    return PetriNet.from_pm4py(ocpn)
