from ocelescope.resource.resource import Annotated, Resource
from ocelescope.visualization import generate_color_map
from ocelescope.visualization.default.graph import Graph, GraphEdge, GraphNode, GraphvizLayoutConfig


class ObjectEdge(Annotated):
    """
    A directed edge between two activities in an object-centric directly-follows graph.

    Attributes:
        source: Source activity name. If ``None``, the edge is considered to originate
            from the object-type-specific start node in the visualization.
        target: Target activity name. If ``None``, the edge is considered to end
            at the object-type-specific end node in the visualization.
        count: Frequency of this directly-follows relation.
    """

    source: str | None = None
    target: str | None = None
    count: int = 0


class DirectlyFollowsGraph(Resource):
    """
    Object-centric Directly Follows Graph (DFG).

    This resource represents directly-follows relations between activities,
    grouped by *object type*. For each object type, the graph contains a list of
    ``ObjectEdge`` instances describing observed transitions.

    Attributes:
        edges: Mapping from object type name to a list of directed edges
            observed for that object type.
        activity_annotations: Optional per-activity annotations used by the
            visualization layer. Keys should match activity names.
        object_type_annotations: Optional per-object-type annotations used by the
            visualization layer. Keys should match object type names.
    """

    label = "Directly Follows Graph"
    description = "A object-centric directly follows graph"

    edges: dict[str, list[ObjectEdge]]

    activity_annotations: dict[str, Resource] = {}
    object_type_annotations: dict[str, Resource] = {}

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
        return {
            object_type: {(edge.source, edge.target): edge.count for edge in value}
            for object_type, value in self.edges.items()
        }

    @property
    def activity_names(self) -> list[str]:
        """
        List all distinct activity names appearing as a source or target.

        Returns:
            A list of unique activity names across all object types.

        """
        return list(
            set(
                [
                    name
                    for edges in self.edges.values()
                    for edge in edges
                    for name in (edge.source, edge.target)
                    if name is not None
                ]
            )
        )

    @property
    def object_type_names(self) -> list[str]:
        """
        List the object types present in this graph.

        Returns:
            A list of object type names (the keys of ``self.edges``).
        """
        return list(self.edges.keys())

    def visualize(self) -> Graph:
        """
        Build a visualization-friendly graph representation.

        Creates:
            - Activity nodes (rectangles), optionally annotated via
              ``self.activity_annotations``.
            - Start/end nodes (circles) per object type, optionally annotated via
              ``self.object_type_annotations``.
            - Colored directed edges per object type with annotation-derived labels.
        """

        color_map = generate_color_map([object_type for object_type in self.object_type_names])

        activity_nodes = [
            GraphNode(
                id=activity,
                label=activity,
                shape="rectangle",
                annotation=self.activity_annotations.get(activity),
                color="#ffffff",
                border_color="#000000",
            )
            for activity in self.activity_names
        ]

        start_nodes = [
            GraphNode(
                id=f"start_{object_type}",
                label=object_type,
                shape="circle",
                color=color_map[object_type],
                width=40,
                height=40,
                label_pos="top",
                annotation=self.object_type_annotations.get(object_type),
            )
            for object_type in self.object_type_names
        ]

        end_nodes = [
            GraphNode(
                id=f"end_{object_type}",
                label=object_type,
                shape="circle",
                color=color_map[object_type],
                width=40,
                height=40,
                label_pos="bottom",
            )
            for object_type in self.object_type_names
        ]

        nodes: list[GraphNode] = activity_nodes + start_nodes + end_nodes

        edges = [
            GraphEdge(
                source=edge.source if edge.source else f"start_{object_type}",
                target=edge.target if edge.target else f"end_{object_type}",
                end_arrow="triangle",
                color=color_map[object_type],
                annotation=edge.get_annotation_visualization(),
                label=edge.get_annotation_str(),
            )
            for object_type, edges in self.edges.items()
            for edge in edges
        ]

        return Graph(
            type="graph",
            nodes=nodes,
            edges=edges,
            layout_config=GraphvizLayoutConfig(
                engine="dot",
                graphAttrs={
                    "rankdir": "BT",
                    "splines": "True",
                    "nodesep": "0.8",
                    "ranksep": "0.5",
                },
            ),
        )
