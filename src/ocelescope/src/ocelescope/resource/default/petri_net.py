from typing import Literal, Optional

from pydantic import BaseModel


from ocelescope.resource.resource import Resource
from ocelescope.visualization.default.graph import Graph, GraphEdge, GraphNode, GraphvizLayoutConfig
from ocelescope.visualization import generate_color_map


class Place(BaseModel):
    """A place in a Petri net.

    Attributes:
        id: Unique identifier of the place.
        object_type: Type of the object associated with this place.
        place_type: Either "sink", "source", or None.
    """

    id: str
    object_type: str
    place_type: Optional[Literal["sink", "source", None]]


class Transition(BaseModel):
    """A transition in a Petri net.

    Attributes:
        id: Unique identifier of the transition.
        label: Optional label describing the transition.
    """

    id: str
    label: Optional[str]


class Arc(BaseModel):
    """An arc connecting places and transitions in a Petri net.

    Attributes:
        source: ID of the source node (place or transition).
        target: ID of the target node (place or transition).
        variable: Whether the arc represents a variable connection.
    """

    source: str
    target: str
    variable: bool = False


class PetriNet(Resource):
    """An object-centric Petri net representation.

    Attributes:
        places: List of places in the Petri net.
        transitions: List of transitions in the Petri net.
        arcs: List of arcs connecting places and transitions.
    """

    label = "Petri Net"
    description = "An object-centric petri net"

    places: list[Place]
    transitions: list[Transition]
    arcs: list[Arc]

    def visualize(self):
        # Use your color generator function
        object_types = list({p.object_type for p in self.places})
        color_map = generate_color_map(object_types)

        # Build nodes
        nodes: list[GraphNode] = []

        for place in self.places:
            nodes.append(
                GraphNode(
                    id=place.id,
                    label=place.object_type if place.place_type else None,
                    shape="circle",
                    color=color_map.get(place.object_type, "#cccccc"),
                    width=30,
                    label_pos="bottom",
                    height=30,
                )
            )

        for transition in self.transitions:
            label = transition.label or None
            nodes.append(
                GraphNode(
                    id=transition.id,
                    label=label,
                    width=None if label else 10,
                    height=None if label else 40,
                    shape="rectangle",
                    color="#ffffff" if label else "#000000",
                    border_color="#000000" if label else None,
                )
            )

        # Build edges
        edges: list[GraphEdge] = []

        for arc in self.arcs:
            object_type = next(
                (p.object_type for p in self.places if p.id in {arc.source, arc.target}),
                "default",
            )
            edges.append(
                GraphEdge(
                    source=arc.source,
                    target=arc.target,
                    arrows=(None, "triangle"),
                    color=color_map.get(object_type, "#cccccc"),
                )
            )

        return Graph(
            type="graph",
            nodes=nodes,
            edges=edges,
            layout_config=GraphvizLayoutConfig(
                engine="dot",
                graphAttrs={
                    "rankdir": "LR",
                    "ranksep": "0.7",
                    "nodesep": "0.7",
                },
            ),
        )
