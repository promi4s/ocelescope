from typing import Literal

from ocelescope.visualization.visualization import Visualization


class SVGVis(Visualization):
    """SVG visualization.

    Use this visualization when you want full control over the rendered output
    by providing raw SVG markup.

    Attributes:
        type: Fixed discriminator `"svg"`.
        svg: SVG markup as a string.
    """

    type: Literal["svg"] = "svg"
    svg: str
