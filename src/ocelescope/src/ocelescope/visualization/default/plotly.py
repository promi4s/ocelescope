from typing import Any, Literal

from plotly.graph_objects import Figure
from pydantic import PrivateAttr, computed_field

from ocelescope.visualization.visualization import Visualization


# TODO: This can not be the best way to do this find a better solution
class Plotly(Visualization):
    type: Literal["plotly"] = "plotly"

    _figure: Figure = PrivateAttr()

    def __init__(self, figure: Figure, **data):
        super().__init__(**data)
        self._figure = figure

    @property
    def figure(self) -> Figure:
        return self._figure

    @figure.setter
    def figure(self, value: Figure):
        self._figure = value

    @computed_field()
    @property
    def data(self) -> dict[str, Any]:
        return self.figure.to_dict()
