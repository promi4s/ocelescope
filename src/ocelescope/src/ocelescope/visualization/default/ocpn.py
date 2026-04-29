from __future__ import annotations

from ocelescope.resource.default.petri_net import Arc, PetriNet, Place
from ocelescope.resource.default.petri_net_graph import PetriNetGraph, to_petri_net_graph
from ocelescope.visualization.default.graph import (
    Graph,
    GraphEdge,
    GraphNode,
    LayoutConfig,
)
from ocelescope.visualization.util.color import generate_color_map


def _place_label(place: Place, *, initial_tokens: int, final_tokens: int) -> str | None:
    if initial_tokens <= 0 and final_tokens <= 0:
        return None

    label_parts = [place.object_type]
    if initial_tokens > 0:
        label_parts.append(f"m0={initial_tokens}")
    if final_tokens > 0:
        label_parts.append(f"mf={final_tokens}")

    return " | ".join(label_parts)


def _arc_label(arc: Arc) -> str | None:
    parts: list[str] = []
    if arc.weight != 1:
        parts.append(str(arc.weight))
    if arc.variable:
        parts.append("var")
    annotation = arc.get_annotation_str()
    if annotation:
        parts.append(annotation)

    if not parts:
        return None

    return " | ".join(parts)


def _place_object_type(graph: PetriNetGraph, source: str, target: str) -> str | None:
    for node_id in (source, target):
        node_data = graph.nodes[node_id]
        if node_data["kind"] == "place":
            return node_data["object_type"]
    return None


def visualize_ocpn(resource: PetriNet) -> Graph:
    graph = to_petri_net_graph(resource)
    color_map = generate_color_map(graph.object_types())
    initial_marking = graph.get_initial_marking()
    final_marking = graph.get_final_marking()

    nodes: list[GraphNode] = []
    for node_id, node_data in graph.nodes(data=True):
        if node_data["kind"] == "place":
            place = node_data["data"]
            initial_tokens = initial_marking.get(node_id, 0)
            final_tokens = final_marking.get(node_id, 0)
            layout_attrs: dict[str, str | int | float | bool] | None = None

            if final_tokens > 0:
                layout_attrs = {"peripheries": 2}

            nodes.append(
                GraphNode(
                    id=node_id,
                    label=_place_label(
                        place,
                        initial_tokens=initial_tokens,
                        final_tokens=final_tokens,
                    ),
                    shape="circle",
                    color=color_map.get(place.object_type, "#cccccc"),
                    width=30,
                    height=30,
                    label_pos="bottom",
                    annotation=place.get_annotation_visualization(),
                    layout_attrs=layout_attrs,
                )
            )
            continue

        transition = node_data["data"]
        label = transition.label or None
        nodes.append(
            GraphNode(
                id=node_id,
                label=label,
                width=None if label else 10,
                height=None if label else 40,
                shape="rectangle",
                color="#ffffff" if label else "#000000",
                border_color="#000000" if label else None,
                annotation=transition.get_annotation_visualization(),
            )
        )

    edges: list[GraphEdge] = []
    for source, target, key, edge_data in graph.edges(keys=True, data=True):
        arc = edge_data["data"]
        object_type = _place_object_type(graph, source, target)

        edges.append(
            GraphEdge(
                source=source,
                target=target,
                end_arrow="triangle",
                color=color_map.get(object_type or "default", "#cccccc"),
                annotation=arc.get_annotation_visualization(),
                label=_arc_label(arc),
                id=f"{source}:{target}:{key}",
                layout_attrs={"style": "dashed"} if arc.variable else None,
            )
        )

    return Graph(
        type="graph",
        nodes=nodes,
        edges=edges,
        layout_config=LayoutConfig(direction="LR"),
    )
