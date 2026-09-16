from ocelescope.discovery import inductive_miner, ocdfg_miner

from ocelescope import (
    OCEL,
    OCEL_FIELD,
    SLIDER_FIELD,
    DirectlyFollowsGraph,
    PetriNet,
    Plugin,
    PluginInput,
    plugin_method,
)


class DiscoveryInput(PluginInput):
    threshold: float = SLIDER_FIELD(min=0, max=1, step=0.01, default=0.5)
    object_types: list[str] = OCEL_FIELD(
        field_type="object_type",
        ocel_id="ocel",
        theme="r4pm",
        title="Included object types",
    )
    activities: list[str] = OCEL_FIELD(
        field_type="event_type",
        ocel_id="ocel",
        theme="r4pm",
        title="Included activities",
    )


class BasePlugin(Plugin):
    label = "Base Plugin"
    description = "A plugin providing base functionality"
    version = "1.0.0"

    @plugin_method(
        label="Discover Directly Follows Graph",
        description="Discover a object centric directly follows graph",
    )
    def discover_ocdfg(self, ocel: OCEL, input: DiscoveryInput) -> DirectlyFollowsGraph:
        ocdfg = ocdfg_miner(ocel, frequency_threshold=input.threshold)
        return ocdfg

    @plugin_method(
        label="Discover Petri Net",
        description="Discover a object centric Petri net",
    )
    def discover_ocpn(self, ocel: OCEL, input: DiscoveryInput) -> PetriNet:
        return inductive_miner(ocel, noise_threshold=input.threshold)
