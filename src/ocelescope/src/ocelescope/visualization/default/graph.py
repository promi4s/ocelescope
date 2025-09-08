from typing import Literal, Optional
from pydantic import BaseModel

from ocelescope.visualization.default.dot import GraphVizLayoutingEngine


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
    """[TODO:description]

    Attributes:
        id: [TODO:attribute]
        label: [TODO:attribute]
        shape: [TODO:attribute]
        width: [TODO:attribute]
        height: [TODO:attribute]
        color: [TODO:attribute]
        x: [TODO:attribute]
        y: [TODO:attribute]
        border_color: [TODO:attribute]
        label_pos: [TODO:attribute]
    """

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


class GraphvizLayoutConfig(BaseModel):
    engine: GraphVizLayoutingEngine = "dot"
    graphAttrs: dict[str, str | int | float | bool] | None = None
    nodeAttrs: dict[str, str | int | float | bool] | None = None
    edgeAttrs: dict[str, str | int | float | bool] | None = None


class Graph(BaseModel):
    type: Literal["graph"]
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    layout_config: GraphvizLayoutConfig | None = None
