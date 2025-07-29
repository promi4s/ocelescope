from typing import Annotated, Union

from pydantic.fields import Field

from .cytoscape import CytoscapeGraph

from .graphs import Graph


Visualization = Annotated[Union[Graph, CytoscapeGraph], Field(discriminator="type")]

__all__ = ["Visualization"]
