from typing import Annotated, TypeAlias, Union

from pydantic import Field

from ocelescope.visualization.default.graph import (
    Graph,
    GraphNode,
    GraphEdge,
    EdgeArrow,
    GraphvizLayoutConfig,
    GraphShapes,
)

from ocelescope.visualization.default.svg import SVGVis

# TODO: Rename this layouting engine a class
from ocelescope.visualization.default.dot import DotVis

from ocelescope.visualization.default.table import TableColumn, Table
from ocelescope.visualization.util.color import generate_color_map

Visualization: TypeAlias = Annotated[
    Union[Graph, Table, SVGVis, DotVis], Field(discriminator="type")
]

__all__ = [
    # Util
    "Visualization",
    "generate_color_map",
    # Graph
    "Graph",
    "GraphNode",
    "GraphEdge",
    "EdgeArrow",
    "GraphvizLayoutConfig",
    "GraphShapes",
    # Table
    "Table",
    "TableColumn",
    # SVG
    "SVGVis",
    # Graphviz
    "DotVis",
]
