from typing import Any, Literal, Optional, TypedDict
from graphviz import Digraph
from typing import Dict
from pydantic import BaseModel
import json


GraphShapes = Literal["circle", "triangle", "rectangle", "diamond", "hexagon"]

EdgeArrow = Optional[
    Literal[
        "triangle",
        "circle-triangle",
        "triangle-backcurve",
        "tee",
        "circle",
        "chevron",
        "triangle-tee",
        "triangle-cross",
        "vee",
        "square",
        "diamond",
    ]
]


class GraphNode(BaseModel):
    id: str
    label: Optional[str] = None
    shape: GraphShapes
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    border_color: Optional[str] = None
    label_pos: Optional[Literal["top", "center", "bottom"]] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    arrows: tuple[EdgeArrow, EdgeArrow]
    color: Optional[str] = None
    label: Optional[str] = None


class GraphvizLayoutConfig(TypedDict):
    engine: str
    dot_attr: Dict[str, Any]


class Graph(BaseModel):
    type: Literal["graph"]
    nodes: list[GraphNode]
    edges: list[GraphEdge]

    def layout_graph(self, layout_config: GraphvizLayoutConfig) -> "Graph":
        dot = Digraph(
            engine=layout_config["engine"],
        )

        dot.attr("graph", **layout_config["dot_attr"])

        for node in self.nodes:
            node_kwargs = {
                "label": node.label or node.id,
                "shape": node.shape,
                "style": "filled",
                "fillcolor": node.color,
            }

            if node.width and node.height:
                node_kwargs["width"] = str(node.width / 72)
                node_kwargs["height"] = str(node.height / 72)
                node_kwargs["fixedsize"] = "true"

            dot.node(node.id, **node_kwargs)

        for edge in self.edges:
            dot.edge(edge.source, edge.target, label=edge.label)

        dot_output = dot.pipe(format="json").decode("utf-8")
        dot_json = json.loads(dot_output)

        layout_info: Dict[str, Dict[str, float]] = {}

        for obj in dot_json.get("objects", []):
            if "pos" in obj:
                x_str, y_str = obj["pos"].split(",")
                layout_info[obj["name"]] = {
                    "x": float(x_str),
                    "y": float(y_str),
                    "width": float(obj.get("width", 0)) * 72,
                    "height": float(obj.get("height", 0)) * 72,
                }

        updated_nodes = []
        for node in self.nodes:
            layout = layout_info.get(node.id, {})
            updated_nodes.append(
                GraphNode(
                    **node.model_dump(exclude={"x", "y", "width", "height"}),
                    x=layout.get("x", 0),
                    y=layout.get("y", 0),
                    width=layout.get("width", node.width),
                    height=layout.get("height", node.height),
                )
            )

        return Graph(type=self.type, nodes=updated_nodes, edges=self.edges)
