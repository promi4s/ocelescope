from __future__ import annotations

import pm4py
from pm4py.objects.petri_net.obj import PetriNet as PMNet
from typing_extensions import Literal

from ocelescope.ocel.filter.filters.entity_type import EventTypeFilter, ObjectTypeFilter
from ocelescope.resource.default.dfg import (
    DFGActivity,
    DFGEdge,
    DFGObject,
    DirectlyFollowsGraph,
)
from ocelescope.resource.default.petri_net import Arc, PetriNet, Place, Transition


def discover_ocdfg(
    ocel,
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
                    annotation=len(events),
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
        object_types=[DFGObject(name=object_type) for object_type in ocdfg["object_types"]],
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

    seen_places: set[str] = set()

    for object_type, pm_net in flat_nets.items():
        pm_net = pm_net[0]  # type: ignore

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
            label = transition.label or transition.name
            if label not in transition_map:
                transition_map[label] = Transition(
                    id=label,
                    label=transition.label,
                )

        for arc in pm_net.arcs:
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
                )
            )

    return PetriNet(
        places=place_set,
        transitions=list(transition_map.values()),
        arcs=arcs,
    )
