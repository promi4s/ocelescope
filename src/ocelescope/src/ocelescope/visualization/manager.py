from __future__ import annotations

from typing import Callable

from ocelescope.resource import DirectlyFollowsGraph, PetriNet, Resource
from ocelescope.visualization.default.dot import DotVis
from ocelescope.visualization.default.ocdfg import visualize_ocdfg
from ocelescope.visualization.default.ocpn import visualize_ocpn
from ocelescope.visualization.default.plotly import Plotly
from ocelescope.visualization.default.graph import Graph
from ocelescope.visualization.default.svg import SVGVis
from ocelescope.visualization.default.table import Table

VisualizationValue = Graph | Table | SVGVis | DotVis | Plotly
ResourceVisualizer = Callable[[Resource], VisualizationValue]


class ResourceVisualizationRegistry:
    def __init__(self) -> None:
        self._visualizers: dict[str, ResourceVisualizer] = {}

    def register(self, resource_type: str, visualizer: ResourceVisualizer) -> None:
        self._visualizers[resource_type] = visualizer

    def visualize(self, resource: Resource) -> VisualizationValue | None:
        visualizer = self._visualizers.get(resource.get_type())
        if visualizer is not None:
            return visualizer(resource)

        return None


def _visualize_petri_net(resource: Resource) -> VisualizationValue:
    if not isinstance(resource, PetriNet):
        raise TypeError(f"Expected PetriNet, got {type(resource).__name__}")
    return visualize_ocpn(resource)


def _visualize_ocdfg(resource: Resource) -> VisualizationValue:
    if not isinstance(resource, DirectlyFollowsGraph):
        raise TypeError(f"Expected DirectlyFollowsGraph, got {type(resource).__name__}")
    return visualize_ocdfg(resource)


resource_visualization_registry = ResourceVisualizationRegistry()
resource_visualization_registry.register(PetriNet.get_type(), _visualize_petri_net)
resource_visualization_registry.register(DirectlyFollowsGraph.get_type(), _visualize_ocdfg)


def visualize_resource(resource: Resource) -> VisualizationValue | None:
    return resource_visualization_registry.visualize(resource)
