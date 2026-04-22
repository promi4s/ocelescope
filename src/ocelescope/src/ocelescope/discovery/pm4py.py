from __future__ import annotations

import pm4py
from pm4py.objects.petri_net.obj import PetriNet as PMNet
from typing_extensions import Literal

from ocelescope import OCEL
from ocelescope.ocel.filter.filters.entity_type import EventTypeFilter, ObjectTypeFilter
from ocelescope.resource.default.dfg import (
    DFGActivity,
    DFGEdge,
    DFGObject,
    DirectlyFollowsGraph,
)
from ocelescope.resource.default.petri_net import Arc, PetriNet, Place, Transition


def discover_ocdfg(
    ocel: OCEL,
    excluded_event_types: list[str],
    excluded_object_types: list[str],
) -> DirectlyFollowsGraph:

    filtered_ocel = ocel.filter(
        [
            EventTypeFilter(event_types=excluded_event_types, mode="exclude"),
            ObjectTypeFilter(object_types=excluded_object_types, mode="exclude"),
        ]
    )

    ocdfg = pm4py.discover_ocdfg(filtered_ocel.ocel)

    edges = []
    for object_type, raw_edges in ocdfg["edges"]["event_couples"].items():
        edges.extend(
            [
                DFGEdge(
                    object_type=object_type,
                    source=source,
                    target=target,
                    annotation=str(len(events)),
                )
                for (source, target), events in raw_edges.items()
            ]
        )

    start_activity_edges = [
        DFGEdge(
            object_type=object_type,
            source=activity,
        )
        for object_type, activities in ocdfg["start_activities"]["events"].items()
        for activity in activities.keys()
    ]

    end_activity_edges = [
        DFGEdge(
            source=activity,
            object_type=object_type,
        )
        for object_type, activities in ocdfg["end_activities"]["events"].items()
        for activity in activities.keys()
    ]

    return DirectlyFollowsGraph(
        activities=[DFGActivity(name=activity) for activity in ocdfg["activities"]],
        edges=edges + start_activity_edges + end_activity_edges,
        object_types=[
            DFGObject(name=object_type) for object_type in ocdfg["object_types"]
        ],
    )


def discover_ocpn(
    ocel,
    variant: Literal["im", "imd"],
    excluded_event_types: list[str],
    excluded_object_types: list[str],
) -> PetriNet:
    filtered_ocel = ocel.filter(
        [
            EventTypeFilter(event_types=excluded_event_types, mode="exclude"),
            ObjectTypeFilter(object_types=excluded_object_types, mode="exclude"),
        ]
    )

    petri_net = pm4py.discover_oc_petri_net(
        inductive_miner_variant=variant,
        ocel=filtered_ocel.ocel,
    )

    flat_nets = petri_net["petri_nets"]

    place_set: list[Place] = []
    transition_map: dict[str, Transition] = {}
    arcs: list[Arc] = []
    initial_marking_by_place: dict[str, int] = {}
    final_marking_by_place: dict[str, int] = {}

    seen_places: set[str] = set()

    for object_type, pm_net in flat_nets.items():
        net, initial_marking, final_marking = pm_net

        for place in net.places:
            qualified_id = f"{object_type}_{place.name}"
            if qualified_id not in seen_places:
                place_set.append(
                    Place(
                        id=qualified_id,
                        object_type=object_type,
                    )
                )
                seen_places.add(qualified_id)

            initial_tokens = int(initial_marking.get(place, 0))
            final_tokens = int(final_marking.get(place, 0))
            if initial_tokens > 0:
                initial_marking_by_place[qualified_id] = initial_tokens
            if final_tokens > 0:
                final_marking_by_place[qualified_id] = final_tokens

        for transition in net.transitions:
            label = transition.label or transition.name
            if label not in transition_map:
                transition_map[label] = Transition(
                    id=label,
                    label=transition.label,
                )

        for arc in net.arcs:
            match arc.source:
                case PMNet.Place(name=name):
                    source_id = f"{object_type}_{name}"
                case PMNet.Transition(label=label, name=name):
                    source_id = label or name
                case _:
                    source_id = str(arc.source)

            match arc.target:
                case PMNet.Place(name=name):
                    target_id = f"{object_type}_{name}"
                case PMNet.Transition(label=label, name=name):
                    target_id = label or name
                case _:
                    target_id = str(arc.target)

            arcs.append(
                Arc(
                    source=source_id,
                    target=target_id,
                    weight=int(getattr(arc, "weight", 1)),
                )
            )

    return PetriNet(
        places=place_set,
        transitions=list(transition_map.values()),
        arcs=arcs,
        initial_marking=initial_marking_by_place,
        final_marking=final_marking_by_place,
    )
