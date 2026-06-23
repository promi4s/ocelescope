from typing import Annotated, TypeAlias, Union

from pydantic import Field

# TODO: Rename this layouting engine a class
from ocelescope.visualization.default.dot import DotVis
from ocelescope.visualization.default.graph import (
    EdgeArrow,
    ElkLayoutConfig,
    Graph,
    GraphEdge,
    GraphNode,
    GraphShapes,
    GraphvizLayoutConfig,
    LayoutConfig,
    directed_elk_graph_layout,
    directed_graph_layout,
    force_graph_layout,
    ordered_tree_layout,
    radial_graph_layout,
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
    "LayoutConfig",
    "ElkLayoutConfig",
    "GraphvizLayoutConfig",
    "GraphShapes",
    "directed_elk_graph_layout",
    "directed_graph_layout",
    "force_graph_layout",
    "ordered_tree_layout",
    "radial_graph_layout",
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
