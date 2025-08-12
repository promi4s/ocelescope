from typing import Annotated

from ocelescope import (
    OCEL,
    Plugin,
    PluginInput,
    OCELAnnotation,
    ResourceAnnotation,
    plugin_meta,
    plugin_method,
    COMPUTED_SELECTION,
    PetriNet,
)
from .quantity_extension import QELExtension


class TestInput(PluginInput, frozen=True):
    test_field: str = COMPUTED_SELECTION(
        provider="nonsense", title="Test", depends_on=["ocel"]
    )

    @staticmethod
    def nonsense(ocel: OCEL):
        return ["asdas", "asdoiqoiq", "diqoiq"]


@plugin_meta(description="This is a test", label="Quantity Plugin", version="1.0")
class QuantityPlugin(Plugin):
    @plugin_method(label="Test", description="Test this shit")
    def test(
        self,
        input: TestInput,
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
        print(petri_net)
        print(ocel)
        return PetriNet(arcs=[], places=[], transitions=[])
