from typing import Annotated
from ocelescope import (
    OCEL,
    PetriNet,
    EventTypeFilter,
    ObjectTypeFilter,
)
from ocelescope.plugin import Plugin, OCELAnnotation, plugin_meta, plugin_method
from ocelescope.resource.default.dfg import DirectlyFollowsGraph
import pm4py

from prototype_plugins.berti.discovery.dfg import compute_ocdfg

from .discovery.petri_net import PetriNetInput, convert_flat_pm4py_to_ocpn


@plugin_meta(
    label="Berti Discovery",
    description="A plugin to discover object-centric process models using the pm4py python library",
    version="1.0",
)
class BertiDiscovery(Plugin):
    @plugin_method(
        label="Discover Petri net", description="Discover a object-centric petri net"
    )
    def petri_net(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
        input: PetriNetInput,
    ) -> PetriNet:
        filtered_ocel = ocel.apply_filter(
            filters={
                "event_type": EventTypeFilter(
                    event_types=input.excluded_event_types, mode="exclude"
                ),
                "object_types": ObjectTypeFilter(
                    object_types=input.excluded_event_types, mode="exclude"
                ),
            }
        )
        petri_net = pm4py.discover_oc_petri_net(
            inductive_miner_variant=input.variant,
            ocel=filtered_ocel.ocel,
            diagnostics_with_tbr=input.enable_token_based_replay,
        )

        petri_net = convert_flat_pm4py_to_ocpn(petri_net["petri_nets"])

        return petri_net

    @plugin_method(
        label="Discover Directly Follows Graph",
        description="Discover a object-centric directly follows graph",
    )
    def directly_follows_graph(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
    ) -> DirectlyFollowsGraph:
        return compute_ocdfg(ocel)
