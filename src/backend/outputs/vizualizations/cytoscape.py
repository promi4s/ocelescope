from typing import Any, Literal
from outputs.base import OutputBase


class CytoscapeGraph(OutputBase):
    type: Literal["cytoscape"]
    elements: list[dict[str, Any]]
    styles: list[dict[str, Any]]
