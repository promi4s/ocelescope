from pydantic.main import BaseModel
from outputs import register_output, OutputBase, register_visulization
from outputs.vizualizations.graphs import (
    Graph,
    GraphEdge,
    GraphNode,
    layout_graph,
)

from util.colors import generate_color_map


class Edge(BaseModel):
    source: str
    target: str
    object_type: str


class ObjectActivityEdge(BaseModel):
    object_type: str
    activity: str


@register_output(label="Directly Follows Graph")
class ObjectCentricDirectlyFollowsGraph(OutputBase):
    type: str = "ocdfg"
    object_types: list[str]
    activities: list[str]
    edges: list[Edge]
    start_activities: list[ObjectActivityEdge]
    end_activities: list[ObjectActivityEdge]


@register_visulization()
def visualize_ocdfg(output: ObjectCentricDirectlyFollowsGraph) -> Graph:
    color_map = generate_color_map(output.object_types)

    activity_nodes = [
        GraphNode(id=activity, label=activity, shape="rectangle")
        for activity in output.activities
    ]

    start_nodes = [
        GraphNode(
            id=f"start_{object_type}",
            label=object_type,
            shape="circle",
            color=color_map[object_type],
            width=20,
            height=20,
        )
        for object_type in output.object_types
    ]

    end_nodes = [
        GraphNode(
            id=f"end_{object_type}",
            label=object_type,
            shape="circle",
            color=color_map[object_type],
            width=50,
            height=50,
        )
        for object_type in output.object_types
    ]

    nodes: list[GraphNode] = activity_nodes + start_nodes + end_nodes

    # Create edges
    activity_edges = [
        GraphEdge(
            source=edge.source,
            target=edge.target,
            arrows=(None, "triangle"),
            color=color_map[edge.object_type],
        )
        for edge in output.edges
    ]

    start_edges = [
        GraphEdge(
            source=f"start_{start_edge.object_type}",
            target=start_edge.activity,
            arrows=(None, "triangle"),
            color=color_map[start_edge.object_type],
        )
        for start_edge in output.start_activities
    ]

    end_edges = [
        GraphEdge(
            target=f"end_{end_edge.object_type}",
            source=end_edge.activity,
            arrows=(None, "triangle"),
            color=color_map[end_edge.object_type],
        )
        for end_edge in output.end_activities
    ]

    edges: list[GraphEdge] = activity_edges + start_edges + end_edges

    return layout_graph(
        Graph(type="graph", nodes=nodes, edges=edges),
        {
            "engine": "dot",
            "dot_attr": {
                "rankdir": "BT",
                "splines": "True",
                "nodesep": "0.8",
                "ranksep": "0.5",
            },
        },
    )
