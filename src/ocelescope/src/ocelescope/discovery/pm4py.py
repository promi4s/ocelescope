import pm4py
from typing_extensions import Literal

from ocelescope import OCEL
from ocelescope.ocel.filter.filters.entity_type import EventTypeFilter, ObjectTypeFilter
from ocelescope.ocel.filter.filters.frequency import (
    EventTypeFrequencyFilter,
    ObjectTypeFrequencyFilter,
)
from ocelescope.resource.default.dfg import (
    DFGActivity,
    DFGEdge,
    DFGObject,
    DirectlyFollowsGraph,
)
from ocelescope.resource.default.petri_net import Arc, ArcType, Marking, PetriNet, Place, Transition


def _apply_discovery_filters(
    *,
    ocel: OCEL,
    excluded_event_types: list[str],
    excluded_object_types: list[str],
    activity_frequency_threshold: int,
    object_frequency_threshold: int,
) -> OCEL:
    filter_pipeline = [
        EventTypeFilter(event_types=excluded_event_types, mode="exclude"),
        ObjectTypeFilter(object_types=excluded_object_types, mode="exclude"),
        EventTypeFrequencyFilter(threshold_percentage=activity_frequency_threshold),
        ObjectTypeFrequencyFilter(threshold_percentage=object_frequency_threshold),
    ]

    return ocel.filter(filter_pipeline)


def discover_ocdfg(
    ocel: OCEL,
    excluded_event_types: list[str],
    excluded_object_types: list[str],
    activity_frequency_threshold: int,
    object_frequency_threshold: int,
) -> DirectlyFollowsGraph:
    filtered_ocel = _apply_discovery_filters(
        ocel=ocel,
        excluded_event_types=excluded_event_types,
        excluded_object_types=excluded_object_types,
        activity_frequency_threshold=activity_frequency_threshold,
        object_frequency_threshold=object_frequency_threshold,
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
        DFGEdge(object_type=object_type, target=activity, annotation=str(len(events)))
        for object_type, activities in ocdfg["start_activities"]["events"].items()
        for activity, events in activities.items()
    ]

    end_activity_edges = [
        DFGEdge(source=activity, object_type=object_type, annotation=str(len(events)))
        for object_type, activities in ocdfg["end_activities"]["events"].items()
        for activity, events in activities.items()
    ]

    return DirectlyFollowsGraph(
        activities=[DFGActivity(name=activity) for activity in ocdfg["activities"]],
        edges=edges + start_activity_edges + end_activity_edges,
        object_types=[DFGObject(name=object_type) for object_type in ocdfg["object_types"]],
    )


def discover_ocpn(
    ocel: OCEL,
    variant: Literal["im", "imd"],
    excluded_event_types: list[str],
    excluded_object_types: list[str],
    activity_frequency_threshold: int,
    object_frequency_threshold: int,
) -> PetriNet:
    filtered_ocel = _apply_discovery_filters(
        ocel=ocel,
        excluded_event_types=excluded_event_types,
        excluded_object_types=excluded_object_types,
        activity_frequency_threshold=activity_frequency_threshold,
        object_frequency_threshold=object_frequency_threshold,
    )

    ocpn = pm4py.discover_oc_petri_net(
        inductive_miner_variant=variant,
        ocel=filtered_ocel.ocel,
    )

    pnet = PetriNet()

    for place in ocpn.places:
        pnet.add_place(
            Place(
                name=place.name,
                object_type=place.object_type,
            )
        )

    for transition in ocpn.transitions:
        pnet.add_transition(Transition(name=transition.name, label=transition.label))

    for arc in ocpn.arcs:
        pnet.add_arc(
            Arc(
                source=str(arc.source.name),
                target=str(arc.target.name),
                type=ArcType.VARIABLE if arc.is_variable else ArcType.NORMAL,
            ),
        )

    pnet.initial_marking = Marking({place.name: 1 for place in ocpn.initial_marking.keys()})
    pnet.final_marking = Marking({place.name: 1 for place in ocpn.final_marking.keys()})

    return pnet
