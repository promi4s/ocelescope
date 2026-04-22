from __future__ import annotations

from typing import Callable

from ocelescope.resource import DirectlyFollowsGraph, PetriNet, Resource
from ocelescope.visualization.default.dot import DotVis
from ocelescope.visualization.default.graph import Graph
from ocelescope.visualization.default.ocdfg import visualize_ocdfg
from ocelescope.visualization.default.ocpn import visualize_ocpn
from ocelescope.visualization.default.plotly import Plotly
from ocelescope.visualization.default.svg import SVGVis
from ocelescope.visualization.default.table import Table

VisualizationValue = Graph | Table | SVGVis | DotVis | Plotly
ResourceVisualizer = Callable[..., VisualizationValue]


class ResourceVisualizationRegistry:
    def __init__(self) -> None:
        self._visualizers: dict[str, ResourceVisualizer] = {}

    def register(self, resource: str, visualizer: ResourceVisualizer) -> None:
        self._visualizers[resource] = visualizer

    def visualize(self, resource: Resource) -> VisualizationValue | None:
        visualizer = self._visualizers.get(resource.get_type())
        if visualizer is None:
            raise KeyError(f"Resource '{resource}' does not support discovery")

        return visualizer(resource)


resource_visualization_registry = ResourceVisualizationRegistry()
resource_visualization_registry.register(PetriNet.get_type(), visualize_ocpn)
resource_visualization_registry.register(DirectlyFollowsGraph.get_type(), visualize_ocdfg)


def visualize_resource(resource: Resource) -> VisualizationValue | None:
    return resource_visualization_registry.visualize(resource)
