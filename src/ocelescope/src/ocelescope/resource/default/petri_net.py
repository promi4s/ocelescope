from typing import Optional

from pydantic import Field
from ocelescope.resource.resource import Annotated, Resource


class Place(Annotated):
    """A place in an object-centric Petri net.

    Each place is associated with exactly one object type, representing
    the lifecycle of objects of that type.

    Attributes:
        id: Unique identifier of the place.
        object_type: Object type whose lifecycle this place belongs to.
    """

    id: str
    object_type: str


class Transition(Annotated):
    """A transition in an object-centric Petri net.

    A transition with a ``None`` label is a silent (tau) transition and
    will be rendered as a thin black bar in the visualization.

    Attributes:
        id: Unique identifier of the transition.
        label: Activity label. ``None`` indicates a silent transition.
    """

    id: str
    label: Optional[str]


class Arc(Annotated):
    """An arc connecting a place and a transition in an object-centric Petri net.

    Variable arcs allow a transition to consume or produce a variable number
    of tokens, used to model synchronisation across object types.

    Attributes:
        source: ID of the source node (place or transition).
        target: ID of the target node (place or transition).
        variable: Whether this is a variable arc.
        weight: Multiplicity of the arc.
    """

    source: str
    target: str
    variable: bool = False
    weight: int = 1


class PetriNet(Resource):
    """An object-centric Petri net (OC-PN).

    Places are partitioned by object type. Transitions may synchronise across
    object types via shared arcs. Variable arcs allow a transition to consume
    or produce tokens from multiple instances of an object type.

    Attributes:
        places: Places in the net, each associated with an object type.
        transitions: Transitions in the net, labeled or silent.
        arcs: Arcs connecting places and transitions.
        initial_marking: Token counts of the initial marking, keyed by place id.
        final_marking: Token counts of the final marking, keyed by place id.
    """

    label = "Petri Net"
    description = "An object-centric petri net"

    places: list[Place] = Field(default_factory=list)
    transitions: list[Transition] = Field(default_factory=list)
    arcs: list[Arc] = Field(default_factory=list)
    initial_marking: dict[str, int] = Field(default_factory=dict)
    final_marking: dict[str, int] = Field(default_factory=dict)
