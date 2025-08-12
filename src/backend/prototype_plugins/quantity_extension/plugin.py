from typing import Annotated

from ocelescope import (
    OCEL,
    Plugin,
    PluginInput,
    OCELAnnotation,
    plugin_meta,
    plugin_method,
    COMPUTED_SELECTION,
)
from .quantity_extension import QELExtension
from .resoure import Test


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
        ocel: Annotated[
            OCEL, OCELAnnotation(label="Quantity OCEL", extension=QELExtension)
        ],
    ) -> Test:
        return Test(type="test")
