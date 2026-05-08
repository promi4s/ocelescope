import pm4py
from pydantic import Field
from typing_extensions import Literal

from ocelescope import OCEL
from ocelescope.discovery.algorithm import (
    DiscoveryAlgorithm,
    FilteredDiscoveryParameters,
)
from ocelescope.ocel.filter.filters.entity_type import EventTypeFilter, ObjectTypeFilter
from ocelescope.ocel.filter.filters.frequency import (
    EventTypeFrequencyFilter,
    ObjectTypeFrequencyFilter,
)
from ocelescope.resource.default.petri_net import PetriNet


class PM4PyObjectCentricInductiveMinerParameters(FilteredDiscoveryParameters):
    variant: Literal["im", "imd"] = Field(
        default="im",
        title="Mining Variant",
        description="Choose the inductive mining variant used for discovery.",
        json_schema_extra={"enumNames": ["IM (traditional)", "IMd (directly-follows)"]},
    )


class PM4PyObjectCentricInductiveMiner(
    DiscoveryAlgorithm[PM4PyObjectCentricInductiveMinerParameters, PetriNet]
):
    name = "Inductive Miner"
    description = "Discover an object-centric Petri net with PM4Py's inductive miner."

    @classmethod
    def run(
        cls,
        *,
        ocel: OCEL,
        parameters: PM4PyObjectCentricInductiveMinerParameters,
    ) -> PetriNet:
        filter_pipeline = [
            EventTypeFilter(event_types=parameters.excluded_event_types, mode="exclude"),
            ObjectTypeFilter(
                object_types=parameters.excluded_object_types,
                mode="exclude",
            ),
            EventTypeFrequencyFilter(
                threshold_percentage=parameters.activity_frequency_threshold
            ),
            ObjectTypeFrequencyFilter(
                threshold_percentage=parameters.object_frequency_threshold
            ),
        ]

        filtered_ocel = ocel.filter(filter_pipeline)

        ocpn = pm4py.discover_oc_petri_net(
            inductive_miner_variant=parameters.variant,
            ocel=filtered_ocel.ocel,
        )

        return PetriNet.from_pm4py(ocpn)
