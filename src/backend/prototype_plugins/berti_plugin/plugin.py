from typing import Annotated, Literal
import pm4py
from pydantic.fields import Field
from pydantic.main import BaseModel

from filters.event_type import EventTypeFilterConfig
from filters.object_type import ObjectTypeFilterConfig
import plugins
from plugins.base import OCELAnnotation
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
    excluded_event_types: list[str] = plugins.util.ocel_field(
        title="Excluded Activities", field_type="event_type", ocel_id="ocel"
    )
    excluded_object_types: list[str] = plugins.util.ocel_field(
        title="Excluded Object Types", field_type="object_type", ocel_id="ocel"
    )


@register_plugin(
    label="Berti Discovery",
    description="A plugin to discover object centric process models using the pm4py library",
    version="1",
)
class BertiDiscovery(BasePlugin):
    @plugin_method(
        label="Discover object centric Petri Net",
        description="Discovers an object-centric Petri net (OCPN) from the provided event log using PM4Py's OCPN discovery algorithm.",
    )
    def discover_petri_net(
        self,
        input: PetriNetInput,
        ocel: Annotated[OCELWrapper, OCELAnnotation(label="Event Log")],
    ):
        filtered_ocel = ocel.apply_filter(
            filters=[
                EventTypeFilterConfig(
                    type="event_type",
                    event_types=input.excluded_event_types,
                    mode="exclude",
                ),
                ObjectTypeFilterConfig(
                    type="object_type",
                    object_types=input.excluded_object_types,
                    mode="exclude",
                ),
            ]
        )
        petri_net = pm4py.discover_oc_petri_net(
            inductive_miner_variant=input.variant,
            ocel=filtered_ocel.ocel,
            diagnostics_with_tbr=input.enable_token_based_replay,
        )

        petri_net = convert_flat_pm4py_to_ocpn(petri_net["petri_nets"])

        return petri_net

    @plugin_method(label="Discover object centric directly follows graph")
    def discover_object_centric_dfg(self, ocel: OCELWrapper):
        return compute_ocdfg(ocel.ocel)
