from typing import Literal

from pydantic import BaseModel
from graphviz import Digraph, Graph


class Graphviz(BaseModel):
    type: Literal["dot"] = "dot"
    dot_string: str

    @classmethod
    def from_graph(cls, graph: Graph | Digraph):
        return cls(type="dot", dot_string=graph.pipe(format="dot", encoding="utf-8"))
