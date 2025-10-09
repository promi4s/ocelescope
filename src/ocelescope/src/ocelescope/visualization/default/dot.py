from typing import Literal

from graphviz import Digraph, Graph

from ocelescope.visualization.visualization import Visualization


GraphVizLayoutingEngine = Literal[
    "circo", "dot", "fdp", "sfdp", "neato", "osage", "patchwork", "twopi", "nop", "nop2"
]


class DotVis(Visualization):
    type: Literal["dot"] = "dot"

    dot_str: str
    layout_engine: GraphVizLayoutingEngine = "dot"

    @classmethod
    def from_graphviz(
        cls, graph: Digraph | Graph, layout_engine: GraphVizLayoutingEngine = "dot"
    ) -> "DotVis":
        return DotVis(dot_str=graph.source, layout_engine=layout_engine)
