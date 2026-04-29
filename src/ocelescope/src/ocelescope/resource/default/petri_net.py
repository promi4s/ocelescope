from typing import Optional

from pydantic import Field

from ocelescope.resource.resource import Annotated, Resource
from ocelescope.visualization.default.graph import Graph, GraphEdge, GraphNode, LayoutConfig
from ocelescope.visualization.util.color import generate_color_map


class Place(Annotated):
    """A place in an object-centric Petri net.

    Each place is associated with exactly one object type, representing
    the lifecycle of objects of that type.

    Attributes:
        id: Unique identifier of the place.
        object_type: Object type whose lifecycle this place belongs to.
    """

    id: str
    object_type: str


class Transition(Annotated):
    """A transition in an object-centric Petri net.

    A transition with a ``None`` label is a silent (tau) transition and
    will be rendered as a thin black bar in the visualization.

    Attributes:
        id: Unique identifier of the transition.
        label: Activity label. ``None`` indicates a silent transition.
    """

    id: str
    label: Optional[str]


class Arc(Annotated):
    """An arc connecting a place and a transition in an object-centric Petri net.

    Variable arcs allow a transition to consume or produce a variable number
    of tokens, used to model synchronisation across object types.

    Attributes:
        source: ID of the source node (place or transition).
        target: ID of the target node (place or transition).
        variable: Whether this is a variable arc.
        weight: Multiplicity of the arc.
    """

    source: str
    target: str
    variable: bool = False
    weight: int = 1


class PetriNet(Resource):
    """An object-centric Petri net (OC-PN).

    Places are partitioned by object type. Transitions may synchronise across
    object types via shared arcs. Variable arcs allow a transition to consume
    or produce tokens from multiple instances of an object type.

    Attributes:
        places: Places in the net, each associated with an object type.
        transitions: Transitions in the net, labeled or silent.
        arcs: Arcs connecting places and transitions.
        initial_marking: Token counts of the initial marking, keyed by place id.
        final_marking: Token counts of the final marking, keyed by place id.
    """

    label = "Petri Net"
    description = "An object-centric petri net"

    places: list[Place] = Field(default_factory=list)
    transitions: list[Transition] = Field(default_factory=list)
    arcs: list[Arc] = Field(default_factory=list)
    initial_marking: dict[str, int] = Field(default_factory=dict)
    final_marking: dict[str, int] = Field(default_factory=dict)

    def visualize(self) -> Graph:
        object_types = list({place.object_type for place in self.places})
        color_map = generate_color_map(object_types)
        place_index = {place.id: place for place in self.places}

        nodes: list[GraphNode] = []

        for place in self.places:
            initial_tokens = self.initial_marking.get(place.id, 0)
            final_tokens = self.final_marking.get(place.id, 0)

            label_parts = [place.object_type]
            if initial_tokens > 0:
                label_parts.append(f"m0={initial_tokens}")
            if final_tokens > 0:
                label_parts.append(f"mf={final_tokens}")
            label = " | ".join(label_parts) if (initial_tokens > 0 or final_tokens > 0) else None

            nodes.append(
                GraphNode(
                    id=place.id,
                    label=label,
                    shape="circle",
                    color=color_map.get(place.object_type, "#cccccc"),
                    width=30,
                    height=30,
                    double_border=final_tokens > 0,
                    label_pos="bottom",
                    annotation=place.get_annotation_visualization(),
                )
            )

        for transition in self.transitions:
            labeled = transition.label is not None
            nodes.append(
                GraphNode(
                    id=transition.id,
                    label=transition.label,
                    width=None if labeled else 10,
                    height=None if labeled else 40,
                    shape="rectangle",
                    color="#ffffff" if labeled else "#000000",
                    border_color="#000000" if labeled else None,
                    annotation=transition.get_annotation_visualization(),
                )
            )

        edges: list[GraphEdge] = []
        arc_counts: dict[tuple[str, str], int] = {}

        for arc in self.arcs:
            key = (arc.source, arc.target)
            arc_counts[key] = arc_counts.get(key, 0) + 1
            arc_index = arc_counts[key] - 1

            object_type = (
                place_index[arc.source].object_type
                if arc.source in place_index
                else place_index.get(arc.target, None) and place_index[arc.target].object_type
            )

            label_parts = []
            if arc.weight != 1:
                label_parts.append(str(arc.weight))
            if arc.variable:
                label_parts.append("var")
            annotation_str = arc.get_annotation_str()
            if annotation_str:
                label_parts.append(annotation_str)

            edges.append(
                GraphEdge(
                    id=f"{arc.source}:{arc.target}:{arc_index}",
                    source=arc.source,
                    target=arc.target,
                    end_arrow="triangle",
                    color=color_map.get(object_type or "", "#cccccc"),
                    annotation=arc.get_annotation_visualization(),
                    label=" | ".join(label_parts) if label_parts else None,
                    dashed=arc.variable,
                )
            )

        return Graph(
            nodes=nodes,
            edges=edges,
            layout_config=LayoutConfig(direction="RIGHT"),
        )
