from typing import Annotated

import pm4py
from pydantic import Field

from ocelescope.ocel import OCEL
from ocelescope.ocel.util import to_pm4py_discovery_log
from ocelescope.resource.default.petri_net import PetriNet


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
    ] = 0.8,
    included_object_types: list[str] | None = None,
    included_activities: list[str] | None = None,
) -> PetriNet:
    pm4py_ocel = to_pm4py_discovery_log(
        ocel,
        included_object_types=included_object_types,
        included_activities=included_activities,
    )
    # pm4py cannot mine an empty log, e.g. when nothing is selected.
    if pm4py_ocel.relations.empty:
        return PetriNet()

    ocpn = pm4py.discover_oc_petri_net(
        ocel=pm4py_ocel,
        noise_threshold=noise_threshold,
        disable_fallthroughs=False,
        disable_strict_sequence_cut=False,
    )
    return PetriNet.from_pm4py(ocpn)
