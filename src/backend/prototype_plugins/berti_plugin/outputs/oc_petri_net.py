from typing import Literal, Optional

from pydantic.main import BaseModel
from outputs import OutputBase, register_output, register_visulization
from util.colors import generate_color_map
from outputs.vizualizations.graphs import (
    Graph,
    GraphEdge,
    GraphNode,
    layout_graph,
)


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


@register_output(label="Petri Net")
class ObjectCentricPetriNet(OutputBase):
    places: list[Place]
    transitions: list[Transition]
    arcs: list[Arc]
    type: str = "ocpn"


@register_visulization()
def petri_net_to_graph(petri_net: ObjectCentricPetriNet) -> Graph:
    # Use your color generator function
    object_types = list({p.object_type for p in petri_net.places})
    color_map = generate_color_map(object_types)

    # Build nodes
    nodes: list[GraphNode] = []

    for place in petri_net.places:
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

    for transition in petri_net.transitions:
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

    for arc in petri_net.arcs:
        object_type = next(
            (
                p.object_type
                for p in petri_net.places
                if p.id in {arc.source, arc.target}
            ),
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

    return layout_graph(
        Graph(
            type="graph",
            nodes=nodes,
            edges=edges,
        ),
        {
            "engine": "dot",
            "dot_attr": {
                "rankdir": "LR",
                "ranksep": "0.7",
                "nodesep": "0.7",
            },
        },
    )
