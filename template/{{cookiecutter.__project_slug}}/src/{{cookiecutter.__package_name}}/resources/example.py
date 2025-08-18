from typing import Literal
from ocelescope import Resource


class ExampleResource(Resource):
    type: Literal["example"] = "example"

    def visualize(self):
        return None
