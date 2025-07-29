from typing import Literal
import pm4py
from pydantic.fields import Field
from pydantic.main import BaseModel

import plugins
import plugins.util


from .util import convert_flat_pm4py_to_ocpn, compute_ocdfg
from ocel.ocel_wrapper import OCELWrapper
from plugins import register_plugin, plugin_method, BasePlugin


class PetriNetInput(BaseModel, frozen=True):
    variant: Literal["im", "imd"] = Field(
        title="Mining Variant",
        description="Variant of the inductive miner to use (“im” for traditional; “imd” for the faster inductive miner directly-follows).",
    )
    enable_token_based_replay: bool = Field(
        default=False,
        title="Enable Token Based Replay",
        description="Enable the computation of diagnostics using token-based replay.",
    )
    test_outpt: list[str] = plugins.util.ocel_field(
        field_type="event_type", ocel_id="ocel"
    )


@register_plugin(
    label="Berti Discovery",
    description="A plugin to discover object centric process models using the pm4py library",
    version="1",
)
class BertiDiscovery(BasePlugin):
    @plugin_method(label="Discover object centric Petri Net")
    def discover_petri_net(self, input: PetriNetInput, ocel: OCELWrapper):
        petri_net = pm4py.discover_oc_petri_net(
            inductive_miner_variant=input.variant,
            ocel=ocel.ocel,
            diagnostics_with_tbr=input.enable_token_based_replay,
        )

        petri_net = convert_flat_pm4py_to_ocpn(petri_net["petri_nets"])

        return petri_net

    @plugin_method(label="Discover object centric directly follows graph")
    def discover_object_centric_dfg(self, ocel: OCELWrapper):
        return compute_ocdfg(ocel.ocel)
