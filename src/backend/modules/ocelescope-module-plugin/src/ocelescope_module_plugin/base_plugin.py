from typing import Annotated

from ocelescope.discovery import inductive_miner, ocdfg_miner

from ocelescope import (
    OCEL,
    OCEL_FIELD,
    SLIDER_FIELD,
    DirectlyFollowsGraph,
    OCELAnnotation,
    PetriNet,
    Plugin,
    PluginInput,
    ResourceAnnotation,
    plugin_method,
)

Paths = Annotated[
    float,
    SLIDER_FIELD(
        min=0.01,
        max=1,
        step=0.01,
        default=0.5,
        title="Paths",
        description=(
            "How many of the less frequent paths to include. "
            "Lower values give a simpler model."
        ),
    ),
]
ObjectTypes = Annotated[
    list[str],
    OCEL_FIELD(
        field_type="object_type",
        ocel_id="ocel",
        theme="r4pm",
        title="Included object types",
        description="Only these object types are used for discovery.",
        default_frequency=0.5,
    ),
]
Activities = Annotated[
    list[str],
    OCEL_FIELD(
        field_type="event_type",
        ocel_id="ocel",
        theme="r4pm",
        title="Included activities",
        description="Only events of these activities are used for discovery.",
        default_frequency=0.5,
    ),
]


class DiscoveryPetriInput(PluginInput):
    paths: Paths
    object_types: ObjectTypes
    activities: Activities


class DiscoveryDFGInput(PluginInput):
    paths: Paths
    activities: Activities


class BasePlugin(Plugin):
    label = "Base Discovery"
    description = "Discover object-centric process models from an event log."
    version = "1.0.0"

    @plugin_method(
        label="Discover Directly-Follows Graph",
        description="Discover an object-centric directly-follows graph.",
    )
    def discover_ocdfg(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event log")],
        input: DiscoveryDFGInput,
    ) -> Annotated[
        DirectlyFollowsGraph, ResourceAnnotation(label="Directly-Follows Graph")
    ]:
        ocdfg = ocdfg_miner(
            ocel,
            frequency_threshold=input.paths,
            included_activities=input.activities,
        )
        return ocdfg

    @plugin_method(
        label="Discover Petri Net",
        description="Discover an object-centric Petri net using the inductive miner.",
    )
    def discover_ocpn(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event log")],
        input: DiscoveryPetriInput,
    ) -> Annotated[PetriNet, ResourceAnnotation(label="Petri Net")]:
        return inductive_miner(
            ocel,
            # pm4py's noise threshold counts what to drop, the slider what to keep.
            noise_threshold=1 - input.paths,
            included_activities=input.activities,
            included_object_types=input.object_types,
        )
