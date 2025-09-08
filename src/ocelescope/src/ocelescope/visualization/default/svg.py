from typing import Literal

from pydantic import BaseModel


class SVGVis(BaseModel):
    type: Literal["svg"]
    svg: str
