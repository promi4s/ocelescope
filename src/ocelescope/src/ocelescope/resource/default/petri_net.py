from typing import Optional

from pydantic import Field
from ocelescope.resource.resource import Annotated, Resource


class Place(Annotated):
    """A place in a Petri net.

    Attributes:
        id: Unique identifier of the place.
        object_type: Type of the object associated with this place.
    """

    id: str
    object_type: str


class Transition(Annotated):
    """A transition in a Petri net.

    Attributes:
        id: Unique identifier of the transition.
        label: Optional label describing the transition.
    """

    id: str
    label: Optional[str]


class Arc(Annotated):
    """An arc connecting places and transitions in a Petri net.

    Attributes:
        source: ID of the source node (place or transition).
        target: ID of the target node (place or transition).
        variable: Whether the arc represents a variable connection.
        weight: Multiplicity of the arc.
    """

    source: str
    target: str
    variable: bool = False
    weight: int = 1


class PetriNet(Resource):
    """An object-centric Petri net representation.

    Attributes:
        places: List of places in the Petri net.
        transitions: List of transitions in the Petri net.
        arcs: List of arcs connecting places and transitions.
        initial_marking: Token counts of the initial marking by place id.
        final_marking: Token counts of the final marking by place id.
    """

    label = "Petri Net"
    description = "An object-centric petri net"

    places: list[Place] = Field(default_factory=list)
    transitions: list[Transition] = Field(default_factory=list)
    arcs: list[Arc] = Field(default_factory=list)
    initial_marking: dict[str, int] = Field(default_factory=dict)
    final_marking: dict[str, int] = Field(default_factory=dict)
