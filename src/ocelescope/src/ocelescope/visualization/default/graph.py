from typing import Generic, Literal, Optional, TypeVar
from pydantic import BaseModel, Field

from ocelescope.util.pydantic import uuid_str
from ocelescope.visualization.default.dot import GraphVizLayoutingEngine
from ocelescope.visualization.visualization import Visualization

T = TypeVar("T", bound=Visualization)


class AnnotatedElement(BaseModel, Generic[T]):
    annotation: T | None = None


GraphShapes = Literal["circle", "triangle", "rectangle", "diamond", "hexagon"]


EdgeArrow = (
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
    | None
)


class GraphNode(AnnotatedElement):
    id: str = Field(default_factory=uuid_str)
    label: Optional[str] = None
    shape: GraphShapes
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    border_color: Optional[str] = None
    label_pos: Optional[Literal["top", "center", "bottom"]] = None

    rank: Literal["source", "sink"] | int | None = None
    layout_attrs: dict[str, str | int | float | bool] | None = None


class GraphEdge(AnnotatedElement):
    id: str = Field(default_factory=uuid_str)
    source: str
    target: str
    color: Optional[str] = None
    label: Optional[str] = None
    start_arrow: EdgeArrow = None
    end_arrow: EdgeArrow = None
    start_label: Optional[str] = None
    end_label: Optional[str] = None

    layout_attrs: dict[str, str | int | float | bool] | None = None


class GraphvizLayoutConfig(BaseModel):
    engine: GraphVizLayoutingEngine = "dot"
    graphAttrs: dict[str, str | int | float | bool] | None = None
    nodeAttrs: dict[str, str | int | float | bool] | None = None
    edgeAttrs: dict[str, str | int | float | bool] | None = None


class Graph(Visualization):
    type: Literal["graph"] = "graph"
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    layout_config: GraphvizLayoutConfig = GraphvizLayoutConfig()
