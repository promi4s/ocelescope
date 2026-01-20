import matplotlib

from ocelescope.ocel import (
    OCEL,
    AttributeSummary,
    BaseFilter,
    E2OCountFilter,
    EventAttributeFilter,
    EventTypeFilter,
    O2OCountFilter,
    ObjectAttributeFilter,
    ObjectTypeFilter,
    OCELExtension,
    RelationCountSummary,
    TimeFrameFilter,
)
from ocelescope.plugin import (
    COMPUTED_SELECTION,
    OCEL_FIELD,
    OCELAnnotation,
    Plugin,
    PluginInput,
    PluginMeta,
    PluginMethod,
    PluginResult,
    ResourceAnnotation,
    plugin_method,
)
from ocelescope.resource import DirectlyFollowsGraph, PetriNet, Resource
from ocelescope.visualization import (
    DotVis,
    EdgeArrow,
    Graph,
    GraphEdge,
    GraphNode,
    GraphShapes,
    GraphvizLayoutConfig,
    SVGVis,
    Table,
    TableColumn,
    Visualization,
    generate_color_map,
)

matplotlib.use("Agg")

__all__ = [
    "OCEL",
    "OCELExtension",
    "E2OCountFilter",
    "EventAttributeFilter",
    "EventTypeFilter",
    "O2OCountFilter",
    "ObjectAttributeFilter",
    "ObjectTypeFilter",
    "TimeFrameFilter",
    "RelationCountSummary",
    "AttributeSummary",
    "Visualization",
    "PetriNet",
    "DirectlyFollowsGraph",
    "Resource",
    "ResourceAnnotation",
    "OCELAnnotation",
    "Plugin",
    "PluginMeta",
    "PluginMethod",
    "COMPUTED_SELECTION",
    "OCEL_FIELD",
    "PluginInput",
    "PluginResult",
    "plugin_method",
    "BaseFilter",
    # Visualization
    # Util
    "Visualization",
    "generate_color_map",
    # Graph
    "Graph",
    "GraphNode",
    "GraphEdge",
    "EdgeArrow",
    "GraphvizLayoutConfig",
    "GraphShapes",
    # Table
    "Table",
    "TableColumn",
    # SVG
    "SVGVis",
    # Graphviz
    "DotVis",
]
