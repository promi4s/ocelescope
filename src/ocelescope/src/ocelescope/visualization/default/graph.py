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
    """A node in a `Graph` visualization.

    A node defines its identity and visual appearance (shape, label, colors, size).
    Layout coordinates (`x`, `y`) are typically filled by the layouting step, not
    by the resource author.

    Attributes:
        id: Unique node id. Defaults to a generated UUID string.
        label: Optional label shown near the node.
        shape: Node shape identifier.
        width: Optional node width.
        height: Optional node height.
        color: Optional fill color (for example hex).
        x: Optional x-coordinate after layouting.
        y: Optional y-coordinate after layouting.
        border_color: Optional border/stroke color.
        label_pos: Label position relative to the node.
        rank: Optional layout constraint (source/sink or numeric rank).
        layout_attrs: Additional Graphviz attributes for this node.
        annotation: Optional attached visualization.
    """

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
    """A directed edge in a `Graph` visualization.

    An edge connects `source` -> `target` and can carry labels and arrowhead styles.

    Attributes:
        id: Unique edge id. Defaults to a generated UUID string.
        source: Source node id.
        target: Target node id.
        color: Optional edge color.
        label: Optional label shown along the edge.
        start_arrow: Optional arrowhead style at the start of the edge.
        end_arrow: Optional arrowhead style at the end of the edge.
        start_label: Optional label shown near the source.
        end_label: Optional label shown near the target.
        layout_attrs: Additional Graphviz attributes for this edge.
        annotation: Optional attached visualization.
    """

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
    """Graph visualization composed of nodes and directed edges.

    This visualization is meant for model-like structures (for example Petri nets
    or directly-follows graphs). Layout and rendering are performed using Graphviz.

    Attributes:
        type: Fixed discriminator `"graph"`.
        nodes: List of nodes.
        edges: List of edges.
        layout_config: Graphviz layout configuration.
    """

    type: Literal["graph"] = "graph"
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    layout_config: LayoutConfig = LayoutConfig()
