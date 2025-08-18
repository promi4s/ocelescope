from typing import Literal

from pydantic import BaseModel
from graphviz import Digraph, Graph


class SVGVis(BaseModel):
    type: Literal["svg"]
    svg: str

    @classmethod
    def from_graph(cls, graph: Graph | Digraph):
        return cls(type="svg", svg=graph.pipe(format="svg", encoding="utf-8"))
