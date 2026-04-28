from typing import Literal, Self

from graphviz import Digraph, Graph

from ocelescope.visualization.visualization import Visualization

GraphvizLayoutEngineName = Literal[
    "circo", "dot", "fdp", "sfdp", "neato", "osage", "patchwork", "twopi", "nop", "nop2"
]


class DotVis(Visualization):
    """Graphviz DOT visualization.

    This visualization stores a raw DOT source string plus the selected layout engine.
    It is useful when you already have DOT output (for example from `graphviz.Digraph`)
    and want to render it directly.

    Attributes:
        type: Fixed discriminator `"dot"`.
        dot_str: The DOT source string.
        layout_engine: Graphviz layout engine used for layouting.
    """

    type: Literal["dot"] = "dot"

    dot_str: str
    layout_engine: GraphvizLayoutEngineName = "dot"

    @classmethod
    def from_graphviz(
        cls, graph: Digraph | Graph, layout_engine: GraphvizLayoutEngineName = "dot"
    ) -> Self:
        """Create a `DotVis` from a Graphviz graph object.

        This helper extracts the DOT source from a `graphviz.Digraph` or `graphviz.Graph`
        instance and stores it in `dot_str`.

        Args:
            graph: A Graphviz `Digraph` or `Graph`.
            layout_engine: Graphviz layout engine name (for example `"dot"`).

        Returns:
            A `DotVis` instance containing the DOT source and the selected layout engine.
        """
        return cls(dot_str=graph.source, layout_engine=layout_engine)
