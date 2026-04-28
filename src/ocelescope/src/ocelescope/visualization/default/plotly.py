import json
from typing import Any, Literal, cast

import plotly.io as pio
from plotly.graph_objects import Figure
from pydantic import PrivateAttr, computed_field

from ocelescope.visualization.visualization import Visualization


# TODO: This can not be the best way to do this find a better solution
class Plotly(Visualization):
    """Plotly visualization.

    This visualization wraps a Plotly `Figure`. The figure is stored internally as a
    private attribute and is exposed through the `figure` property.

    The JSON-serializable representation is provided by the computed `data` field,
    which serializes the figure to Plotly JSON.

    Attributes:
        type: Fixed discriminator `"plotly"`.
        figure: Wrapped Plotly figure (available as a property).

    Notes:
        The figure is stored in a Pydantic private attribute (`_figure`).
        The `data` field is computed from `figure` using Plotly JSON serialization.
    """

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

    # TODO: Make this better it crashes with plotly_json_dump
    @computed_field()
    @property
    def data(self) -> dict[str, Any]:
        json_string = cast(str, pio.to_json(self._figure, validate=False))
        return json.loads(json_string)
