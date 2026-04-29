from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from ocelescope.util.pydantic import uuid_factory
from ocelescope.visualization.visualization import Visualization

T = TypeVar("T", bound=Visualization)


class AnnotatedElement(BaseModel, Generic[T]):
    annotation: T | None = None


GraphShapes = Literal["circle", "triangle", "rectangle", "diamond", "hexagon", "start", "end"]


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
    id: str = Field(default_factory=uuid_factory)
    label: str | None = None
    shape: GraphShapes
    width: float | None = None
    height: float | None = None
    color: str | None = None
    x: float | None = None
    y: float | None = None
    border_color: str | None = None
    label_pos: Literal["top", "center", "bottom"] = "center"

    rank: Literal["source", "sink"] | int | None = None
    layout_attrs: dict[str, str | int | float | bool] | None = None


class GraphEdge(AnnotatedElement):
    id: str = Field(default_factory=uuid_factory)
    source: str
    target: str
    color: str | None = None
    label: str | None = None
    start_arrow: EdgeArrow = None
    end_arrow: EdgeArrow = None
    start_label: str | None = None
    end_label: str | None = None

    layout_attrs: dict[str, str | int | float | bool] | None = None


class LayoutConfig(BaseModel):
    direction: Literal["LR", "TB", "RL", "BT"] = "TB"


class Graph(Visualization):
    type: Literal["graph"] = "graph"
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    layout_config: LayoutConfig = LayoutConfig()
