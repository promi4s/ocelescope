from typing import Literal

from graphviz import Digraph, Graph
from pydantic import BaseModel


GraphVizLayoutingEngine = Literal[
    "circo", "dot", "fdp", "sfdp", "neato", "osage", "patchwork", "twopi", "nop", "nop2"
]


class DotVis(BaseModel):
    type: Literal["dot"]
    dot_str: str
    layout_engine: GraphVizLayoutingEngine

    @classmethod
    def from_graphviz(
        cls, graph: Digraph | Graph, layout_engine: GraphVizLayoutingEngine
    ) -> "DotVis":
        return DotVis(dot_str=graph.source, type="dot", layout_engine=layout_engine)
