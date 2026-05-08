import pm4py

from ocelescope import OCEL
from ocelescope.discovery.algorithm import (
    DiscoveryAlgorithm,
    FilteredDiscoveryParameters,
)
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


class PM4PyObjectCentricDFGParameters(FilteredDiscoveryParameters):
    pass


class PM4PyObjectCentricDFG(
    DiscoveryAlgorithm[PM4PyObjectCentricDFGParameters, DirectlyFollowsGraph]
):
    name = "Object-Centric DFG"
    description = "Discover an object-centric directly-follows graph with PM4Py."

    @classmethod
    def run(
        cls,
        *,
        ocel: OCEL,
        parameters: PM4PyObjectCentricDFGParameters,
    ) -> DirectlyFollowsGraph:
        filter_pipeline = [
            EventTypeFilter(event_types=parameters.excluded_event_types, mode="exclude"),
            ObjectTypeFilter(
                object_types=parameters.excluded_object_types,
                mode="exclude",
            ),
            EventTypeFrequencyFilter(
                threshold_percentage=parameters.activity_frequency_threshold
            ),
            ObjectTypeFrequencyFilter(
                threshold_percentage=parameters.object_frequency_threshold
            ),
        ]

        filtered_ocel = ocel.filter(filter_pipeline)

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
                target=activity,
                annotation=str(len(events)),
            )
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
            object_types=[
                DFGObject(name=object_type) for object_type in ocdfg["object_types"]
            ],
        )
