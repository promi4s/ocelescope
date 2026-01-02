from ocelescope.resource.resource import Annotated, Resource
from ocelescope.visualization import generate_color_map
from ocelescope.visualization.default.graph import Graph, GraphEdge, GraphNode, GraphvizLayoutConfig


class Edge(Annotated):
    source: str | None
    target: str | None
    object_type: str


class ObjectType(Annotated):
    name: str


class Activity(Annotated):
    name: str


class DirectlyFollowsGraph(Resource):
    label = "Directly Follows Graph"
    description = "A object-centric directly follows graph"

    object_types: list[ObjectType]
    activities: list[Activity]
    edges: list[Edge]

    def visualize(self):
        color_map = generate_color_map([object_type.name for object_type in self.object_types])

        activity_nodes = [
            GraphNode(
                id=activity.name,
                label=activity.name,
                shape="rectangle",
                annotation=activity.get_annotation_visualization(),
                color="#ffffff",
            )
            for activity in self.activities
        ]

        start_nodes = [
            GraphNode(
                id=f"start_{object_type}",
                label=object_type.name,
                shape="circle",
                color=color_map[object_type.name],
                width=40,
                height=40,
                label_pos="top",
                annotation=object_type.get_annotation_visualization(),
            )
            for object_type in self.object_types
        ]

        end_nodes = [
            GraphNode(
                id=f"end_{object_type}",
                label=object_type.name,
                shape="circle",
                color=color_map[object_type.name],
                width=40,
                height=40,
                label_pos="bottom",
            )
            for object_type in self.object_types
        ]

        nodes: list[GraphNode] = activity_nodes + start_nodes + end_nodes

        edges = [
            GraphEdge(
                source=edge.source if edge.source else f"start_{edge.object_type}",
                target=edge.target if edge.target else f"end_{edge.object_type}",
                end_arrow="triangle",
                color=color_map[edge.object_type],
                annotation=edge.get_annotation_visualization(),
                label=edge.get_annotation_str(),
            )
            for edge in self.edges
        ]

        return Graph(
            type="graph",
            nodes=nodes,
            edges=edges,
            layout_config=GraphvizLayoutConfig(
                engine="dot",
                graphAttrs={
                    "rankdir": "BT",
                    "splines": "True",
                    "nodesep": "0.8",
                    "ranksep": "0.5",
                },
            ),
        )
