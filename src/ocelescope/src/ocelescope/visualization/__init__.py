from typing import Annotated, TypeAlias

from pydantic import Field

from ocelescope.visualization.default.dfg import (
    DFG,
    DirectlyFollowsGraphViz,
    OCDirectlyFollowsGraphViz,
)

# TODO: Rename this layouting engine a class
from ocelescope.visualization.default.dot import DotVis
from ocelescope.visualization.default.graph import (
    DIRECTED_ELK_GRAPH_LAYOUT,
    DIRECTED_GRAPH_LAYOUT,
    FORCE_GRAPH_LAYOUT,
    ORDERED_TREE_LAYOUT,
    RADIAL_GRAPH_LAYOUT,
    EdgeArrow,
    ElkLayoutConfig,
    Graph,
    GraphEdge,
    GraphNode,
    GraphShapes,
    GraphvizLayoutConfig,
    LayoutConfig,
)
from ocelescope.visualization.default.petri_net import (
    Arc,
    OCArc,
    OCPetriNetViz,
    OCPlace,
    PetriNetViz,
    Place,
    Transition,
)
from ocelescope.visualization.default.plotly import Plotly
from ocelescope.visualization.default.svg import SVGVis
from ocelescope.visualization.default.table import Table, TableColumn
from ocelescope.visualization.util.color import generate_color_map

Visualization: TypeAlias = Annotated[
    Graph
    | Table
    | SVGVis
    | DotVis
    | Plotly
    | PetriNetViz
    | OCPetriNetViz
    | DirectlyFollowsGraphViz
    | OCDirectlyFollowsGraphViz,
    Field(discriminator="type"),
]

__all__ = [
    "DFG",
    "DIRECTED_ELK_GRAPH_LAYOUT",
    "DIRECTED_GRAPH_LAYOUT",
    "FORCE_GRAPH_LAYOUT",
    "ORDERED_TREE_LAYOUT",
    "RADIAL_GRAPH_LAYOUT",
    "Arc",
    "DirectlyFollowsGraphViz",
    "DotVis",
    "EdgeArrow",
    "ElkLayoutConfig",
    "Graph",
    "GraphEdge",
    "GraphNode",
    "GraphShapes",
    "GraphvizLayoutConfig",
    "LayoutConfig",
    "OCArc",
    "OCDirectlyFollowsGraphViz",
    "OCPetriNetViz",
    "OCPlace",
    "PetriNetViz",
    "Place",
    "Plotly",
    "SVGVis",
    "Table",
    "TableColumn",
    "Transition",
    "Visualization",
    "generate_color_map",
]
