from typing import Annotated
from ocelescope.ocel.ocel import OCEL
from ocelescope.plugin import Plugin
from ocelescope.plugin.decorators import (
    OCELAnnotation,
    ResourceAnnotation,
    plugin_meta,
    plugin_method,
)
from ocelescope.resource.default.petri_net import PetriNet
from .quantity_extension import QELExtension


@plugin_meta(description="This is a test", label="Quantity Plugin", version="1.0")
class QuantityPlugin(Plugin):
    @plugin_method(label="Test", description="Test this shit")
    def test(
        self,
        ocel: Annotated[
            OCEL, OCELAnnotation(label="Quantity OCEL", extension=QELExtension)
        ],
        petri_net: Annotated[
            PetriNet,
            ResourceAnnotation(
                label="A Petri net", description="A Object Centric Petri net"
            ),
        ],
    ) -> PetriNet:
        return PetriNet(arcs=[], places=[], transitions=[])
