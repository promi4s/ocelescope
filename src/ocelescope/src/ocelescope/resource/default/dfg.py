from typing import Any

from pydantic import Field

from ocelescope.resource.resource import Annotated, Resource
from ocelescope.visualization.default.graph import (
    DIRECTED_ELK_GRAPH_LAYOUT,
    Graph,
    GraphEdge,
    GraphNode,
    NodeStyle,
)
from ocelescope.visualization.util.color import generate_color_map


class DFGActivity(Annotated):
    """
    An activity node in an object-centric directly-follows graph.

    Attributes:
        name: The activity name.
    """

    name: str


class DFGObject(Annotated):
    """
    An object type in an object-centric directly-follows graph.

    Attributes:
        name: The object type name.
    """

    name: str


class DFGEdge(Annotated):
    """
    A directed edge between two activities in an object-centric directly-follows graph.

    Attributes:
        object_type: The object type this edge belongs to.
        source: Source activity name. If ``None``, the edge originates from the
            object-type-specific start node in the visualization.
        target: Target activity name. If ``None``, the edge ends at the
            object-type-specific end node in the visualization.
        count: Frequency of this directly-follows relation.
    """

    object_type: str
    source: str | None = None
    target: str | None = None
    count: int = 0


class DirectlyFollowsGraph(Resource):
    """
    Object-centric Directly Follows Graph (DFG).

    This resource represents directly-follows relations between activities,
    grouped by *object type*.

    Attributes:
        activities: List of activity nodes, optionally annotated.
        object_types: List of object types, optionally annotated.
        edges: List of directed edges, each carrying its object type.
    """

    label = "Directly Follows Graph"
    description = "A object-centric directly follows graph"

    activities: list[DFGActivity] = Field(default_factory=list)
    object_types: list[DFGObject] = Field(default_factory=list)
    edges: list[DFGEdge] = Field(default_factory=list)

    @property
    def counts(self) -> dict[str, dict[tuple[str | None, str | None], int]]:
        """
        Return edge counts per object type.

        Returns:
            A nested mapping ``{object_type: {(source, target): count}}``.

        Notes:
            ``source`` and/or ``target`` may be ``None`` to represent transitions
            from the start node or to the end node for a given object type.
        """
        result: dict[str, dict[tuple[str | None, str | None], int]] = {}
        for edge in self.edges:
            result.setdefault(edge.object_type, {})[(edge.source, edge.target)] = edge.count
        return result

    @property
    def activity_names(self) -> list[str]:
        """
        List all distinct activity names.

        Returns:
            A list of unique activity names.
        """
        return [activity.name for activity in self.activities]

    @property
    def object_type_names(self) -> list[str]:
        """
        List the object types present in this graph.

        Returns:
            A list of object type names.
        """
        return [object_type.name for object_type in self.object_types]

    def filter_edges(self, threshold: float) -> "DirectlyFollowsGraph":
        """Return a copy retaining only edges whose relative frequency >= threshold.

        Relative frequency is edge.count / total_count_for_that_object_type,
        so values are comparable across object types of different sizes.
        Activities and object types with no remaining edges are also pruned.
        At threshold=0 the original graph is returned unchanged.
        """
        if threshold == 0 or not self.edges:
            return self
        totals: dict[str, int] = {}
        for e in self.edges:
            totals[e.object_type] = totals.get(e.object_type, 0) + e.count
        kept_edges = [
            e for e in self.edges
            if totals[e.object_type] > 0 and e.count / totals[e.object_type] >= threshold
        ]
        active_activities = {e.source for e in kept_edges if e.source} | {e.target for e in kept_edges if e.target}
        active_object_types = {e.object_type for e in kept_edges}
        return DirectlyFollowsGraph(
            activities=[a for a in self.activities if a.name in active_activities],
            object_types=[ot for ot in self.object_types if ot.name in active_object_types],
            edges=kept_edges,
        )

    @classmethod
    def from_pm4py(cls, ocdfg: Any) -> "DirectlyFollowsGraph":
        """Convert a pm4py OCDFG dict to a DirectlyFollowsGraph."""
        edges = [
            DFGEdge(
                object_type=object_type,
                source=source,
                target=target,
                count=len(events),
                annotation=str(len(events)),
            )
            for object_type, raw_edges in ocdfg["edges"]["event_couples"].items()
            for (source, target), events in raw_edges.items()
        ]

        start_edges = [
            DFGEdge(
                object_type=object_type,
                target=activity,
                count=len(events),
                annotation=str(len(events)),
            )
            for object_type, activities in ocdfg["start_activities"]["events"].items()
            for activity, events in activities.items()
        ]

        end_edges = [
            DFGEdge(
                source=activity,
                object_type=object_type,
                count=len(events),
                annotation=str(len(events)),
            )
            for object_type, activities in ocdfg["end_activities"]["events"].items()
            for activity, events in activities.items()
        ]

        return cls(
            activities=[DFGActivity(name=a) for a in ocdfg["activities"]],
            object_types=[DFGObject(name=ot) for ot in ocdfg["object_types"]],
            edges=edges + start_edges + end_edges,
        )

    def visualize(self) -> Graph:
        color_map = generate_color_map([ot.name for ot in self.object_types], "custom")

        start_object_types = {
            edge.object_type
            for edge in self.edges
            if edge.source is None and edge.target is not None
        }
        end_object_types = {
            edge.object_type
            for edge in self.edges
            if edge.source is not None and edge.target is None
        }

        activity_nodes = [
            GraphNode(
                id=activity.name,
                label=activity.name,
                shape="rectangle",
                width=140,
                height=40,
                annotation=activity.get_annotation_visualization(),
                color="#ffffff",
                border_color="#000000",
            )
            for activity in self.activities
        ]

        start_nodes = [
            GraphNode(
                id=f"start_{ot.name}",
                label=ot.name,
                shape="circle",
                color=color_map[ot.name],
                border_color="#000000",
                width=44,
                height=44,
                style=NodeStyle(inner_symbol="triangle"),
                label_pos="bottom",
                annotation=ot.get_annotation_visualization(),
            )
            for ot in self.object_types
            if ot.name in start_object_types
        ]

        end_nodes = [
            GraphNode(
                id=f"end_{ot.name}",
                label=ot.name,
                shape="circle",
                color=color_map[ot.name],
                border_color="#000000",
                width=44,
                height=44,
                style=NodeStyle(inner_symbol="square"),
                label_pos="bottom",
            )
            for ot in self.object_types
            if ot.name in end_object_types
        ]

        edges = [
            GraphEdge(
                source=edge.source if edge.source else f"start_{edge.object_type}",
                target=edge.target if edge.target else f"end_{edge.object_type}",
                end_arrow="triangle",
                color=color_map[edge.object_type],
                annotation=edge.get_annotation_visualization(),
                label=edge.get_annotation_str(),
            )
            for edge in self.edges
        ]

        return Graph(
            nodes=activity_nodes + start_nodes + end_nodes,
            edges=edges,
            layout_config=DIRECTED_ELK_GRAPH_LAYOUT,
        )
