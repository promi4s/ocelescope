from typing import Annotated, TypeAlias, Union

from pydantic import Field

# TODO: Rename this layouting engine a class
from ocelescope.visualization.default.dot import DotVis
from ocelescope.visualization.default.graph import (
    EdgeArrow,
    Graph,
    GraphEdge,
    GraphNode,
    GraphShapes,
    GraphvizLayoutConfig,
)
from ocelescope.visualization.default.plotly import Plotly
from ocelescope.visualization.default.svg import SVGVis
from ocelescope.visualization.default.table import Table, TableColumn
from ocelescope.visualization.util.color import generate_color_map

Visualization: TypeAlias = Annotated[
    Union[Graph, Table, SVGVis, DotVis, Plotly], Field(discriminator="type")
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
    # Plotly
    "Plotly",
]
