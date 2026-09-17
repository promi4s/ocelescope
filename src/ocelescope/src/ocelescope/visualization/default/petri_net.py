from typing import Literal

from pydantic import BaseModel, Field

from ocelescope.visualization.visualization import Visualization


class Place(BaseModel):
    id: str


class OCPlace(Place):
    object_type: str


class Transition(BaseModel):
    id: str
    label: str | None = Field(default=None)


class Arc(BaseModel):
    source: str
    target: str
    weight: float | None = Field(default=None)


class OCArc(Arc):
    source: str
    target: str
    weight: float | None = Field(default=None)
    variable: bool = Field(default=False)


class PetriNetBase(BaseModel):
    transitions: list[Transition] = Field(default_factory=list)
    initial_marking: dict[str, int] = Field(default_factory=dict)
    final_marking: dict[str, int] = Field(default_factory=dict)


class PetriNetViz(Visualization, PetriNetBase):
    type: Literal["r4pm_petri_net"] = "r4pm_petri_net"
    places: list[Place] = Field(default_factory=list)
    arcs: list[Arc]


class OCPetriNetViz(Visualization, PetriNetBase):
    type: Literal["r4pm_oc_petri_net"] = "r4pm_oc_petri_net"
    places: list[OCPlace] = Field(default_factory=list)
    arcs: list[OCArc]
