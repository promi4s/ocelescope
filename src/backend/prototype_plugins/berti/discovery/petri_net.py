from typing import Literal
from ocelescope.plugin import PluginInput, OCEL_FIELD
from ocelescope.resource.default.petri_net import Arc, Place, Transition
from pydantic.fields import Field

from ocelescope import PetriNet

from pm4py.objects.petri_net.obj import PetriNet as PMNet


class PetriNetInput(PluginInput, frozen=True):
    variant: Literal["im", "imd"] = Field(
        title="Mining Variant",
        description="Variant of the inductive miner to use (“im” for traditional; “imd” for the faster inductive miner directly-follows).",
    )
    enable_token_based_replay: bool = Field(
        default=False,
        title="Enable Token Based Replay",
        description="Enable the computation of diagnostics using token-based replay.",
    )
    excluded_event_types: list[str] = OCEL_FIELD(
        title="Excluded Activities", field_type="event_type", ocel_id="ocel"
    )

    excluded_object_types: list[str] = OCEL_FIELD(
        title="Excluded Object Types", field_type="object_type", ocel_id="ocel"
    )


def convert_flat_pm4py_to_ocpn(flat_nets: dict[str, PMNet]) -> PetriNet:
    place_set: list[Place] = []
    transition_map: dict[str, Transition] = {}
    arcs: list[Arc] = []

    seen_places: set[str] = set()

    for object_type, pm_net in flat_nets.items():
        pm_net = pm_net[0]  # type:ignore

        for place in pm_net.places:
            qualified_id = f"{object_type}_{place.name}"
            if qualified_id not in seen_places:
                place_set.append(
                    Place(
                        id=qualified_id,
                        place_type="source"
                        if place.name == "source"
                        else "sink"
                        if place.name == "sink"
                        else None,
                        object_type=object_type,
                    )
                )
                seen_places.add(qualified_id)

        for transition in pm_net.transitions:
            label = transition.label or transition.name  # Use fallback if label is None
            if label not in transition_map:
                transition_map[label] = Transition(
                    id=label,
                    label=transition.label,
                )

        for arc in pm_net.arcs:
            source_id = (
                arc.source.name
                if isinstance(arc.source, (PMNet.Place, PMNet.Transition))
                else str(arc.source)
            )
            target_id = (
                arc.target.name
                if isinstance(arc.target, (PMNet.Place, PMNet.Transition))
                else str(arc.target)
            )

            # Adjust for qualified place IDs
            if isinstance(arc.source, PMNet.Place):
                source_id = f"{object_type}_{source_id}"
            if isinstance(arc.target, PMNet.Place):
                target_id = f"{object_type}_{target_id}"

            # If transition, map to unified label
            if isinstance(arc.source, PMNet.Transition):
                source_id = arc.source.label or arc.source.name
            if isinstance(arc.target, PMNet.Transition):
                target_id = arc.target.label or arc.target.name

            arcs.append(
                Arc(
                    source=source_id,
                    target=target_id,
                    variable=False,
                )
            )

    # Assemble the final Petri net and OCPN
    return PetriNet(
        type="ocpn",
        places=place_set,
        transitions=list(transition_map.values()),
        arcs=arcs,
    )
