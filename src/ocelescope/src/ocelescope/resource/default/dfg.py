from pydantic import Field

from ocelescope.resource.resource import Annotated, Resource
from ocelescope.visualization.default.graph import (
    Graph,
    GraphEdge,
    GraphNode,
    LayoutConfig,
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

    def visualize(self) -> Graph:
        color_map = generate_color_map([ot.name for ot in self.object_types])

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
                style=NodeStyle(inner_symbol="triangle"),
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
                style=NodeStyle(inner_symbol="square"),
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
            layout_config=LayoutConfig(
                elk_options={
                    "elk.direction": "RIGHT",
                    "elk.algorithm": "layered",
                    "elk.edgeRouting": "ORTHOGONAL",
                    "elk.spacing.nodeNode": "50",
                    "elk.layered.spacing.nodeNodeBetweenLayers": "80",
                    "elk.spacing.edgeEdge": "40",
                    "elk.spacing.edgeNode": "25",
                }
            ),
        )
