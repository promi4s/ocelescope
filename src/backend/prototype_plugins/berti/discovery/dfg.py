from ocelescope import OCEL, DirectlyFollowsGraph
import pm4py
from ocelescope.resource.default.dfg import (
    ObjectActivityEdge,
    Edge,
)


def compute_ocdfg(ocel: OCEL) -> DirectlyFollowsGraph:
    ocdfg = pm4py.discover_ocdfg(ocel.ocel)

    edge_count_dict = {}
    for object_type, values in ocdfg["edges"]["event_couples"].items():
        for key, events in values.items():
            edge_count_dict[(object_type, key)] = len(events)

    edges = []
    for object_type, raw_edges in ocdfg["edges"]["event_couples"].items():
        edges = edges + (
            [
                Edge(
                    object_type=object_type,
                    source=source,
                    target=target,
                )
                for source, target in raw_edges
            ]
        )

    start_activity_edges = [
        ObjectActivityEdge(
            object_type=object_type,
            activity=activity,
        )
        for object_type, activities in ocdfg["start_activities"]["events"].items()
        for activity in activities.keys()
    ]

    end_activity_edges = [
        ObjectActivityEdge(
            object_type=object_type,
            activity=activity,
        )
        for object_type, activities in ocdfg["end_activities"]["events"].items()
        for activity in activities.keys()
    ]

    return DirectlyFollowsGraph(
        activities=ocdfg["activities"],
        edges=edges,
        object_types=ocdfg["object_types"],
        end_activities=end_activity_edges,
        start_activities=start_activity_edges,
    )
