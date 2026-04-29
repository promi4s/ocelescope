from pydantic import Field

from ocelescope.resource.resource import Annotated, Resource


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
