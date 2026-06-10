from collections import defaultdict
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID

import networkx as nx
from pydantic import Field

if TYPE_CHECKING:
    from pm4py.objects.petri_net.obj import Marking as Pm4pyMarking
    from pm4py.objects.petri_net.obj import PetriNet as Pm4pyPetriNet

from ocelescope.resource.resource import Annotated, Resource
from ocelescope.visualization.default.graph import (
    EdgeStyle,
    Graph,
    GraphEdge,
    GraphNode,
    LayoutConfig,
    NodeStyle,
)
from ocelescope.visualization.util.color import generate_color_map


class Place(Annotated):
    """A place in an object-centric Petri net.

    Each place is associated with exactly one object type, representing
    the lifecycle of objects of that type.

    Attributes:
        name: Unique identifier of the place.
        object_type: Object type whose lifecycle this place belongs to.
    """

    name: str
    object_type: str


class Transition(Annotated):
    """A transition in an object-centric Petri net.

    A transition with a ``None`` label is a silent (tau) transition and
    will be rendered as a thin black bar in the visualization.

    Attributes:
        name: Unique identifier of the transition.
        label: Activity label. ``None`` indicates a silent transition.
    """

    name: str
    label: Optional[str] = None


class ArcType(str, Enum):
    NORMAL = "normal"
    VARIABLE = "variable"


class Arc(Annotated):
    """An arc connecting a place and a transition in an object-centric Petri net.

    Variable arcs allow a transition to consume or produce a variable number
    of tokens, used to model synchronisation across object types.

    Attributes:
        source: name of the source node (place or transition).
        target: name of the target node (place or transition).
        type: Whether this is a variable arc.
        weight: Multiplicity of the arc.
    """

    source: str
    target: str
    type: ArcType = ArcType.NORMAL
    weight: int = 1


class Marking(defaultdict):
    """A sparse Petri-net marking represented as token counts per place.
    Missing places are interpreted as zero tokens.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(int)
        initial_data = dict(*args, **kwargs)
        for place, tokens in initial_data.items():
            self[place] = tokens

    def __setitem__(self, place: str, tokens: int) -> None:
        if tokens < 0:
            raise ValueError(f"Token count for place {place!r} must be non-negative.")
        if tokens == 0:
            self.pop(place, None)
        else:
            super().__setitem__(place, tokens)

    @property
    def places(self) -> set[str]:
        """Places that contain at least one token."""
        return set(self.keys())

    def __repr__(self) -> str:
        if not self:
            return "[]"

        entries = sorted(self.items(), key=lambda item: item[0])
        return ", ".join(f"{place}: {tokens}" for place, tokens in entries)

    def __str__(self) -> str:
        return self.__repr__()


class PetriNet(Resource):
    """An object-centric Petri net (OC-PN).

    Places are partitioned by object type. Transitions may synchronise across
    object types via shared arcs. Variable arcs allow a transition to consume
    or produce tokens from multiple instances of an object type.

    Attributes:
        places: Places in the net, each associated with an object type.
        transitions: Transitions in the net, labeled or silent.
        arcs: Arcs connecting places and transitions.
        initial_marking: Token counts of the initial marking, keyed by place name.
        final_marking: Token counts of the final marking, keyed by place name.
    """

    label = "Petri Net"
    description = "An object-centric Petri net"

    places: list[Place] = Field(default_factory=list)
    transitions: list[Transition] = Field(default_factory=list)
    arcs: list[Arc] = Field(default_factory=list)
    initial_marking: dict[str, int] = Field(default_factory=dict)
    final_marking: dict[str, int] = Field(default_factory=dict)

    def _place_names(self) -> set[str]:
        return {p.name for p in self.places}

    def _transition_names(self) -> set[str]:
        return {t.name for t in self.transitions}

    def add_place(self, place: Place) -> None:
        all_nodes = self._place_names() | self._transition_names()
        if place.name in all_nodes:
            raise ValueError(f"A node with name {place.name!r} already exists.")
        self.places.append(place)

    def add_transition(self, transition: Transition) -> None:
        all_nodes = self._place_names() | self._transition_names()
        if transition.name in all_nodes:
            raise ValueError(f"A node with name {transition.name!r} already exists.")
        self.transitions.append(transition)

    def add_arc(self, arc: Arc) -> None:
        place_names = self._place_names()
        transition_names = self._transition_names()
        all_nodes = place_names | transition_names

        if arc.source not in all_nodes:
            raise ValueError(f"Unknown source node: {arc.source!r}")
        if arc.target not in all_nodes:
            raise ValueError(f"Unknown target node: {arc.target!r}")

        source_is_place = arc.source in place_names
        target_is_place = arc.target in place_names

        if source_is_place == target_is_place:
            raise ValueError("Arcs must connect a place and a transition.")
        if arc.weight < 1:
            raise ValueError("Arc weight must be at least 1.")

        self.arcs.append(arc)

    def to_networkx(self) -> nx.MultiDiGraph:
        graph = nx.MultiDiGraph()

        for place in self.places:
            graph.add_node(
                place.name,
                kind="place",
                name=place.name,
                object_type=place.object_type,
            )

        for transition in self.transitions:
            graph.add_node(
                transition.name,
                kind="transition",
                name=transition.name,
                label=transition.label,
            )

        for arc in self.arcs:
            graph.add_edge(
                arc.source,
                arc.target,
                source=arc.source,
                target=arc.target,
                type=arc.type,
                weight=arc.weight,
            )

        return graph

    def visualize(self) -> Graph:
        object_types = [place.object_type for place in self.places]
        color_map = generate_color_map(object_types, "custom")
        place_index = {place.name: place for place in self.places}

        nodes: list[GraphNode] = []

        for place in self.places:
            initial_tokens = self.initial_marking.get(place.name, 0)
            final_tokens = self.final_marking.get(place.name, 0)

            nodes.append(
                GraphNode(
                    id=place.name,
                    label=place.object_type if initial_tokens else None,
                    shape="circle",
                    color=color_map.get(place.object_type, "#cccccc"),
                    border_color="#000000",
                    width=44,
                    height=44,
                    style=NodeStyle(
                        double_border=final_tokens > 0,
                        initial_tokens=initial_tokens or None,
                        final_tokens=final_tokens or None,
                    ),
                    label_pos="bottom",
                    annotation=place.get_annotation_visualization(),
                )
            )

        for transition in self.transitions:
            labeled = transition.label is not None

            nodes.append(
                GraphNode(
                    id=transition.name,
                    label=transition.label,
                    width=140 if labeled else 10,
                    height=40,
                    shape="rectangle",
                    color="#ffffff" if labeled else "#000000",
                    border_color="#000000" if labeled else None,
                    annotation=transition.get_annotation_visualization(),
                )
            )

        edges: list[GraphEdge] = []

        for arc in self.arcs:
            source_place = place_index.get(arc.source)
            target_place = place_index.get(arc.target)
            object_type = (
                source_place.object_type
                if source_place is not None
                else target_place.object_type
                if target_place is not None
                else None
            )

            label_parts: list[str] = []

            if arc.weight != 1:
                label_parts.append(str(arc.weight))

            annotation_str = arc.get_annotation_str()
            if annotation_str:
                label_parts.append(annotation_str)

            edges.append(
                GraphEdge(
                    id=f"{arc.source}:{arc.target}",
                    source=arc.source,
                    target=arc.target,
                    end_arrow="triangle",
                    color=color_map.get(object_type or "", "#cccccc"),
                    annotation=arc.get_annotation_visualization(),
                    label=" | ".join(label_parts),
                    style=EdgeStyle(bold=arc.type == ArcType.VARIABLE),
                )
            )

        return Graph(
            nodes=nodes,
            edges=edges,
            layout_config=LayoutConfig(
                elk_options={
                    "elk.algorithm": "layered",
                    "elk.direction": "RIGHT",
                    "elk.edgeRouting": "SPLINES",
                    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
                    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
                    "elk.layered.nodePlacement.bk.edgeStraightening": "IMPROVE_STRAIGHTNESS",
                    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
                    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
                    "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
                    "elk.spacing.nodeNode": 22,
                    "elk.layered.spacing.nodeNodeBetweenLayers": 34,
                    "elk.spacing.edgeNode": 12,
                    "elk.layered.spacing.edgeNodeBetweenLayers": 15,
                    "elk.spacing.edgeEdge": 15,
                    "elk.spacing.labelNode": 6,
                    "elk.spacing.edgeLabel": 6,
                    "elk.spacing.labelLabel": 4,
                    "elk.edgeLabels.placement": "CENTER",
                    "elk.edgeLabels.inline": "false",
                }
            ),
        )

    @classmethod
    def from_pm4py(cls, ocpn: Any) -> "PetriNet":
        """Convert a pm4py ObjectCentricPetriNet to a PetriNet.

        Rewrites UUID transition names to their activity labels for stability
        across runs. pm4py assigns random UUIDs to visible transitions while
        the stable identity is stored in the label.
        """

        def _is_uuid(value: object) -> bool:
            try:
                UUID(str(value))
            except (TypeError, ValueError):
                return False
            return True

        pnet = cls()
        transition_name_map: dict[str, str] = {}

        for place in ocpn.places:
            pnet.add_place(Place(name=place.name, object_type=place.object_type))

        for transition in ocpn.transitions:
            original_name = str(transition.name)
            transition_name = (
                str(transition.label)
                if transition.label is not None and _is_uuid(original_name)
                else original_name
            )
            transition_name_map[original_name] = transition_name
            pnet.add_transition(Transition(name=transition_name, label=transition.label))

        for arc in ocpn.arcs:
            pnet.add_arc(
                Arc(
                    source=transition_name_map.get(str(arc.source.name), str(arc.source.name)),
                    target=transition_name_map.get(str(arc.target.name), str(arc.target.name)),
                    type=ArcType.VARIABLE if arc.is_variable else ArcType.NORMAL,
                )
            )

        pnet.initial_marking = Marking({place.name: 1 for place in ocpn.initial_marking.keys()})
        pnet.final_marking = Marking({place.name: 1 for place in ocpn.final_marking.keys()})

        return pnet

    def to_pm4py(
        self,
    ) -> tuple["Pm4pyPetriNet", "Pm4pyMarking", "Pm4pyMarking"]:
        from pm4py.objects.petri_net.obj import Marking
        from pm4py.objects.petri_net.obj import PetriNet as Pm4pyPetriNet
        from pm4py.objects.petri_net.utils import petri_utils

        net = Pm4pyPetriNet()

        place_map: dict[str, Pm4pyPetriNet.Place] = {}
        for place in self.places:
            p = Pm4pyPetriNet.Place(place.name)
            net.places.add(p)
            place_map[place.name] = p

        transition_map: dict[str, Pm4pyPetriNet.Transition] = {}
        for transition in self.transitions:
            t = Pm4pyPetriNet.Transition(transition.name, transition.label)
            net.transitions.add(t)
            transition_map[transition.name] = t

        node_map: dict[str, Any] = {**place_map, **transition_map}
        for arc in self.arcs:
            petri_utils.add_arc_from_to(
                node_map[arc.source], node_map[arc.target], net, weight=arc.weight
            )

        initial_marking = Marking(
            {place_map[name]: tokens for name, tokens in self.initial_marking.items()}
        )
        final_marking = Marking(
            {place_map[name]: tokens for name, tokens in self.final_marking.items()}
        )

        return net, initial_marking, final_marking
