from typing import Generic, Literal, Optional, TypeVar
from pydantic import BaseModel

from ocelescope.visualization.default.dot import GraphVizLayoutingEngine
from ocelescope.visualization.visualization import Visualization

T = TypeVar("T", bound=Visualization)


class AnnotatedElement(BaseModel, Generic[T]):
    annotation: T | None = None


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


class GraphNode(AnnotatedElement):
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


class GraphEdge(AnnotatedElement):
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


class Graph(Visualization):
    type: Literal["graph"] = "graph"
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    layout_config: GraphvizLayoutConfig
