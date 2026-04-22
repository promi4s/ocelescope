from pydantic import Field
from ocelescope.resource.resource import Annotated, Resource


class DFGEdge(Annotated):
    source: str | None = None
    target: str | None = None
    object_type: str


class DFGObject(Annotated):
    name: str


class DFGActivity(Annotated):
    name: str


class DirectlyFollowsGraph(Resource):
    label = "Directly Follows Graph"
    description = "A object-centric directly follows graph"

    object_types: list[DFGObject] = Field(default_factory=list)
    activities: list[DFGActivity] = Field(default_factory=list)
    edges: list[DFGEdge] = Field(default_factory=list)
