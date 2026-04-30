from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

from ocelescope.util.pydantic import uuid_factory
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


class NodeStyle(BaseModel):
    """Visual style options for a `GraphNode`.

    Attributes:
        double_border: Renders a second border inside the node (e.g. final-marking places).
        inner_symbol: Optional symbol rendered inside the node shape.
    """

    double_border: bool = False
    inner_symbol: Literal["triangle", "square"] | None = None


class EdgeStyle(BaseModel):
    """Visual style options for a `GraphEdge`.

    Attributes:
        dashed: Renders the edge as a dashed line (e.g. variable arcs).
    """

    dashed: bool = False


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
        style: Visual style options.
        label_pos: Label position relative to the node.
        rank: Optional layout constraint (source/sink or numeric rank).
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
    style: NodeStyle = NodeStyle()
    label_pos: Literal["top", "center", "bottom"] = "center"

    rank: Literal["source", "sink"] | int | None = None


class GraphEdge(AnnotatedElement):
    """A directed edge in a `Graph` visualization.

    An edge connects `source` -> `target` and can carry labels and arrowhead styles.

    Attributes:
        id: Unique edge id. Defaults to a generated UUID string.
        source: Source node id.
        target: Target node id.
        color: Optional edge color.
        label: Optional label shown along the edge.
        style: Visual style options.
        start_arrow: Optional arrowhead style at the start of the edge.
        end_arrow: Optional arrowhead style at the end of the edge.
        start_label: Optional label shown near the source.
        end_label: Optional label shown near the target.
        annotation: Optional attached visualization.
    """

    id: str = Field(default_factory=uuid_factory)
    source: str
    target: str
    color: str | None = None
    label: str | None = None
    style: EdgeStyle = EdgeStyle()
    start_arrow: EdgeArrow = None
    end_arrow: EdgeArrow = None
    start_label: str | None = None
    end_label: str | None = None


class LayoutConfig(BaseModel):
    """ELK-based layout configuration for a `Graph` visualization.

    Attributes:
        elk_options: Additional ELK layout options passed directly to the renderer.
            Keys and values mirror the ELK option format (e.g. ``{"elk.algorithm": "force"}``).

            For all available options see https://eclipse.dev/elk/reference/options.html.
    """

    elk_options: dict[str, str | int | float | bool] | None = None


class Graph(Visualization):
    """Graph visualization composed of nodes and directed edges.

    This visualization is meant for model-like structures (for example Petri nets
    or directly-follows graphs). Layout is performed by the frontend renderer (ELK).

    Attributes:
        type: Fixed discriminator `"graph"`.
        nodes: List of nodes.
        edges: List of edges.
        layout_config: Layout hints consumed by the renderer.
    """

    type: Literal["graph"] = "graph"
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    layout_config: LayoutConfig = LayoutConfig()
