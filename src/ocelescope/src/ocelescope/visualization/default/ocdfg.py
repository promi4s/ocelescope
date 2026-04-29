from __future__ import annotations

from ocelescope.resource.default.dfg import DirectlyFollowsGraph
from ocelescope.visualization.default.graph import (
    Graph,
    GraphEdge,
    GraphNode,
    LayoutConfig,
)
from ocelescope.visualization.util.color import generate_color_map


def visualize_ocdfg(resource: DirectlyFollowsGraph) -> Graph:
    color_map = generate_color_map([object_type.name for object_type in resource.object_types])
    start_object_types = {
        edge.object_type
        for edge in resource.edges
        if edge.source is None and edge.target is not None
    }
    end_object_types = {
        edge.object_type
        for edge in resource.edges
        if edge.source is not None and edge.target is None
    }

    activity_nodes = [
        GraphNode(
            id=activity.name,
            label=activity.name,
            shape="rectangle",
            annotation=activity.get_annotation_visualization(),
            color="#ffffff",
            border_color="#000000",
        )
        for activity in resource.activities
    ]

    start_nodes = [
        GraphNode(
            id=f"start_{object_type.name}",
            label=object_type.name,
            shape="start",
            color=color_map[object_type.name],
            annotation=object_type.get_annotation_visualization(),
        )
        for object_type in resource.object_types
        if object_type.name in start_object_types
    ]

    end_nodes = [
        GraphNode(
            id=f"end_{object_type.name}",
            label=object_type.name,
            shape="end",
            color=color_map[object_type.name],
        )
        for object_type in resource.object_types
        if object_type.name in end_object_types
    ]

    edges = [
        GraphEdge(
            source=edge.source if edge.source else f"start_{edge.object_type}",
            target=edge.target if edge.target else f"end_{edge.object_type}",
            end_arrow="triangle",
            color=color_map[edge.object_type],
            annotation=edge.get_annotation_visualization(),
            label=edge.get_annotation_str(),
        )
        for edge in resource.edges
    ]

    return Graph(
        type="graph",
        nodes=activity_nodes + start_nodes + end_nodes,
        edges=edges,
        layout_config=LayoutConfig(direction="LR"),
    )
