from __future__ import annotations

import networkx as nx

from ocelescope.resource.default.petri_net import Arc, PetriNet, Place, Transition


class PetriNetGraph(nx.MultiDiGraph):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.graph.setdefault("initial_marking", {})
        self.graph.setdefault("final_marking", {})

    def add_place(self, name: str, object_type: str, place: Place | None = None) -> None:
        self.add_node(
            name,
            kind="place",
            object_type=object_type,
            data=place or Place(id=name, object_type=object_type),
        )

    def add_transition(
        self,
        name: str,
        label: str | None = None,
        transition: Transition | None = None,
    ) -> None:
        self.add_node(
            name,
            kind="transition",
            data=transition or Transition(id=name, label=label),
        )

    def add_arc(
        self,
        source: str,
        target: str,
        *,
        weight: int = 1,
        variable: bool = False,
        arc: Arc | None = None,
    ) -> None:
        self.add_edge(
            source,
            target,
            key=str(self.number_of_edges(source, target)),
            data=arc or Arc(source=source, target=target, weight=weight, variable=variable),
        )

    def set_initial_marking(self, place_id: str, tokens: int) -> None:
        if tokens <= 0:
            self.graph["initial_marking"].pop(place_id, None)
            return
        self.graph["initial_marking"][place_id] = tokens

    def set_final_marking(self, place_id: str, tokens: int) -> None:
        if tokens <= 0:
            self.graph["final_marking"].pop(place_id, None)
            return
        self.graph["final_marking"][place_id] = tokens

    def get_initial_marking(self) -> dict[str, int]:
        return dict(self.graph["initial_marking"])

    def get_final_marking(self) -> dict[str, int]:
        return dict(self.graph["final_marking"])

    def place_names(self) -> list[str]:
        return sorted(
            node_id for node_id, data in self.nodes(data=True) if data.get("kind") == "place"
        )

    def transition_names(self) -> list[str]:
        return sorted(
            node_id for node_id, data in self.nodes(data=True) if data.get("kind") == "transition"
        )

    def object_types(self) -> list[str]:
        return sorted(
            {
                data["object_type"]
                for _, data in self.nodes(data=True)
                if data.get("kind") == "place" and data.get("object_type") is not None
            }
        )


def to_petri_net_graph(petri_net: PetriNet) -> PetriNetGraph:
    graph = PetriNetGraph()

    for place in petri_net.places:
        graph.add_place(place.id, object_type=place.object_type, place=place)

    for transition in petri_net.transitions:
        graph.add_transition(
            transition.id,
            label=transition.label,
            transition=transition,
        )

    for arc in petri_net.arcs:
        graph.add_arc(
            arc.source,
            arc.target,
            weight=arc.weight,
            variable=arc.variable,
            arc=arc,
        )

    for place_id, tokens in petri_net.initial_marking.items():
        graph.set_initial_marking(place_id, tokens)

    for place_id, tokens in petri_net.final_marking.items():
        graph.set_final_marking(place_id, tokens)

    return graph


def from_petri_net_graph(graph: PetriNetGraph) -> PetriNet:
    places: list[Place] = []
    transitions: list[Transition] = []
    arcs: list[Arc] = []

    for _, node_data in graph.nodes(data=True):
        if node_data["kind"] == "place":
            places.append(node_data["data"])
        elif node_data["kind"] == "transition":
            transitions.append(node_data["data"])

    for _, _, _, edge_data in graph.edges(keys=True, data=True):
        arcs.append(edge_data["data"])

    return PetriNet(
        places=places,
        transitions=transitions,
        arcs=arcs,
        initial_marking=graph.get_initial_marking(),
        final_marking=graph.get_final_marking(),
    )


def to_networkx(petri_net: PetriNet) -> PetriNetGraph:
    return to_petri_net_graph(petri_net)


def get_place(graph: PetriNetGraph, node_id: str) -> Place | None:
    node_data = graph.nodes[node_id]
    return node_data["data"] if node_data.get("kind") == "place" else None


def get_transition(graph: PetriNetGraph, node_id: str) -> Transition | None:
    node_data = graph.nodes[node_id]
    return node_data["data"] if node_data.get("kind") == "transition" else None


def get_arc(graph: PetriNetGraph, source: str, target: str, key: str) -> Arc:
    edge_data = graph.edges[source, target, key]
    return edge_data["data"]
