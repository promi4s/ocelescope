from typing import Literal, Optional

from pydantic import BaseModel


from ocelescope.resource.resource import Resource
from ocelescope.visualization.default.graph import Graph, GraphEdge, GraphNode
from ocelescope.visualization import generate_color_map


class Place(BaseModel):
    id: str
    object_type: str
    place_type: Optional[Literal["sink", "source", None]]


class Transition(BaseModel):
    id: str
    label: Optional[str]


class Arc(BaseModel):
    source: str
    target: str
    variable: bool = False


class PetriNet(Resource):
    places: list[Place]
    transitions: list[Transition]
    arcs: list[Arc]
    type: Literal["ocpn"] = "ocpn"

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
        ).layout_graph(
            {
                "engine": "dot",
                "dot_attr": {
                    "rankdir": "LR",
                    "ranksep": "0.7",
                    "nodesep": "0.7",
                },
            },
        )
