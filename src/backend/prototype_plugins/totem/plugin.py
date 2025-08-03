from pydantic.fields import Field
from pydantic.main import BaseModel


from ocelescope import OCEL
from plugins import register_plugin, plugin_method, BasePlugin
from .util import mine_totem


class TotemInput(BaseModel, frozen=True):
    noise_filter: float = Field(
        title="τ",
        description="Filters out weak or noisy relations between object types. A higher value keeps only the most consistent patterns.",
        ge=0,
        le=1,
    )


@register_plugin(
    label="TOTem",
    description="Mines a Temporal Object Type Model (TOTeM) from an object-centric event log, capturing temporal and cardinality relations between object types.",
    version="1",
)
class TotemDiscover(BasePlugin):
    @plugin_method(label="Mine TOTem")
    def totem(self, input: TotemInput, ocel: OCEL):
        return mine_totem(ocel=ocel.ocel, tau=input.noise_filter)
