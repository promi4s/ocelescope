from typing import Literal


from ocelescope.visualization.visualization import Visualization


class SVGVis(Visualization):
    type: Literal["svg"] = "svg"
    svg: str
