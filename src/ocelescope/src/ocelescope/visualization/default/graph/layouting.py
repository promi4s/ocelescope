from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from ocelescope.visualization.default.dot import GraphvizLayoutEngineName


class GraphvizLayoutConfig(BaseModel):
    type: Literal["graphviz"] = "graphviz"
    engine: GraphvizLayoutEngineName = "dot"
    graphAttrs: dict[str, str | int | float | bool] | None = None
    nodeAttrs: dict[str, str | int | float | bool] | None = None
    edgeAttrs: dict[str, str | int | float | bool] | None = None


class ElkLayoutConfig(BaseModel):
    """ELK-based layout configuration for a `Graph` visualization.

    Attributes:
        options: Additional ELK layout options passed directly to the renderer.
            Keys and values mirror the ELK option format (e.g. ``{"elk.algorithm": "force"}``).

            For all available options see https://eclipse.dev/elk/reference/options.html.
    """

    type: Literal["elk"] = "elk"
    options: dict[str, str | int | float | bool] | None = None


LayoutConfig = Annotated[Union[GraphvizLayoutConfig, ElkLayoutConfig], Field(discriminator="type")]


DIRECTED_GRAPH_LAYOUT = GraphvizLayoutConfig(
    engine="dot",
    graphAttrs={
        "rankdir": "LR",
        "nodesep": 0.35,
        "ranksep": 0.55,
        "splines": "spline",
    },
)
"""Left-to-right layered layout for directed model graphs.

Useful for process models, directly-follows graphs, Petri nets, and other
graphs where edge direction should communicate progression.
"""


DIRECTED_ELK_GRAPH_LAYOUT = ElkLayoutConfig(
    options={
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "SPLINES",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.separateConnectedComponents": True,
        "elk.spacing.nodeNode": 48,
        "elk.spacing.edgeNode": 24,
        "elk.spacing.edgeEdge": 16,
        "elk.spacing.componentComponent": 96,
        "elk.layered.cycleBreaking.strategy": "GREEDY",
        "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
        "elk.layered.crossingMinimization.greedySwitch.activationThreshold": 40,
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.nodePlacement.favorStraightEdges": True,
        "elk.layered.spacing.nodeNodeBetweenLayers": 120,
        "elk.layered.spacing.edgeNodeBetweenLayers": 36,
        "elk.layered.spacing.edgeEdgeBetweenLayers": 18,
        "elk.layered.thoroughness": 15,
        "elk.layered.unnecessaryBendpoints": False,
    },
)
"""High-quality ELK layered layout for large directed model graphs.

This is the preferred ELK preset for large Petri nets: it favors a stable
left-to-right flow, spline edges, explicit layer spacing, and stronger
crossing minimization without forcing frontend-specific defaults.
"""

ORDERED_TREE_LAYOUT = GraphvizLayoutConfig(
    engine="dot",
    graphAttrs={
        "ordering": "out",
        "rankdir": "TB",
        "nodesep": 0.3,
        "ranksep": 0.5,
        "splines": "line",
    },
)
"""Top-down tree layout that preserves child order from the edge list.

Useful for process trees, expression trees, parse trees, and other rooted
structures where sibling order carries meaning.
"""


RADIAL_GRAPH_LAYOUT = GraphvizLayoutConfig(
    engine="twopi",
    graphAttrs={
        "ranksep": 0.85,
        "splines": "spline",
        "overlap": "false",
    },
)
"""Radial layout for connected relationship graphs.

Useful for object-to-object graphs or social-style networks where there is
no single process direction and neighborhoods matter more than layers.
"""


FORCE_GRAPH_LAYOUT = GraphvizLayoutConfig(
    engine="sfdp",
    graphAttrs={
        "overlap": "false",
        "splines": "spline",
    },
)
"""Force-directed layout for general non-hierarchical graphs.

Useful for dense or cyclic graphs where neither layering nor a radial root
produces a readable result.
"""
