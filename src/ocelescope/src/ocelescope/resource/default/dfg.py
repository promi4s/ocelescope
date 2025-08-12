from typing import Literal
from pydantic import BaseModel


from ocelescope.resource.resource import Resource

from ocelescope.visualization import generate_color_map
from ocelescope.visualization.default.graph import Graph, GraphEdge, GraphNode


class Edge(BaseModel):
    source: str
    target: str
    object_type: str


class ObjectActivityEdge(BaseModel):
    object_type: str
    activity: str


class DirectlyFollowsGraph(Resource):
    type: Literal["ocdfg"] = "ocdfg"
    object_types: list[str]
    activities: list[str]
    edges: list[Edge]
    start_activities: list[ObjectActivityEdge]
    end_activities: list[ObjectActivityEdge]

    def visualize(self):
        color_map = generate_color_map(self.object_types)

        activity_nodes = [
            GraphNode(id=activity, label=activity, shape="rectangle")
            for activity in self.activities
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
            )
            for object_type in self.object_types
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
            for object_type in self.object_types
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
            for edge in self.edges
        ]

        start_edges = [
            GraphEdge(
                source=f"start_{start_edge.object_type}",
                target=start_edge.activity,
                arrows=(None, "triangle"),
                color=color_map[start_edge.object_type],
            )
            for start_edge in self.start_activities
        ]

        end_edges = [
            GraphEdge(
                target=f"end_{end_edge.object_type}",
                source=end_edge.activity,
                arrows=(None, "triangle"),
                color=color_map[end_edge.object_type],
            )
            for end_edge in self.end_activities
        ]

        edges: list[GraphEdge] = activity_edges + start_edges + end_edges

        return Graph(type="graph", nodes=nodes, edges=edges).layout_graph(
            {
                "engine": "dot",
                "dot_attr": {
                    "rankdir": "BT",
                    "splines": "True",
                    "nodesep": "0.8",
                    "ranksep": "0.5",
                },
            }
        )
