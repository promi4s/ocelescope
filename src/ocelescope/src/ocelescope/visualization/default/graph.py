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
        double_border: Whether to render a double border (for example final-marking places).
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
    double_border: bool = False
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
        dashed: Whether to render the edge as a dashed line.
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
    dashed: bool = False
    start_arrow: EdgeArrow = None
    end_arrow: EdgeArrow = None
    start_label: str | None = None
    end_label: str | None = None


ELKAlgorithm = Literal["layered", "force", "stress", "mrtree", "radial", "box", "fixed"]
ELKEdgeRouting = Literal["ORTHOGONAL", "POLYLINE", "SPLINES"]
ELKDirection = Literal["RIGHT", "LEFT", "UP", "DOWN"]


class LayoutConfig(BaseModel):
    """ELK-based layout configuration for a `Graph` visualization.

    All fields are optional; omitted fields fall back to the renderer's defaults.

    Attributes:
        direction: Primary layout direction (ELK direction names).
        algorithm: ELK layout algorithm.
        edge_routing: Edge routing style.
        node_spacing: Pixel spacing between nodes in the same layer.
        layer_spacing: Pixel spacing between layers.
        edge_edge_spacing: Pixel spacing between parallel edges.
        edge_node_spacing: Pixel spacing between edges and nodes.
    """

    direction: ELKDirection = "DOWN"
    algorithm: ELKAlgorithm | None = None
    edge_routing: ELKEdgeRouting | None = None
    node_spacing: float | None = None
    layer_spacing: float | None = None
    edge_edge_spacing: float | None = None
    edge_node_spacing: float | None = None


class Graph(Visualization):
    """Graph visualization composed of nodes and directed edges.

    This visualization is meant for model-like structures (for example Petri nets
    or directly-follows graphs). Layout is performed by the frontend renderer (ELK).

    Attributes:
        type: Fixed discriminator `"graph"`.
        nodes: List of nodes.
        edges: List of edges.
        layout_config: Layout hints (direction, spacing) consumed by the renderer.
    """

    type: Literal["graph"] = "graph"
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    layout_config: LayoutConfig = LayoutConfig()
