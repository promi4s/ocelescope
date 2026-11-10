from typing import Annotated

import ebi
from pandas import DataFrame
from pm4py import convert_to_event_log
from pm4py.objects.log.obj import EventLog
from pydantic import Field

from ocelescope import OCEL
from ocelescope.discovery.ocpn import discover_ocpn
from ocelescope.resource.default.petri_net import PetriNet


def ebi_inductive_miner(
    ocel: OCEL,
    noise_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
            title="Noise Threshold",
            description="Fraction of infrequent behaviour to filter out (0 = no filtering, IMf variant).",
        ),
    ] = 0.2,
    variable_arc_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
            title="Variable arc threshold",
            description="Fraction of events that need to include a single object for the activity to be non-variable.",
        ),
    ] = 0.8,
    included_object_types: list[str] | None = None,
    included_activities: list[str] | None = None,
) -> PetriNet:
    def discover(flattened: DataFrame, object_type: str) -> PetriNet:
        # Ebi is a compiled extension without type information.
        tree_imf = ebi.discover_non_stochastic_inductive_miner_infrequent(  # type: ignore
            _to_ebi_log(flattened), noise_threshold
        )
        lpn = ebi.convert_labelled_petri_net(tree_imf)  # type: ignore
        net = PetriNet.from_ebi(lpn, object_type)
        # Ebi does not set the final marking but we know that the inductive miner
        # discovers workflow nets. Thus there is a single sink place
        net.final_marking = {_sink(net): 1}
        return net

    return discover_ocpn(
        ocel,
        discover,
        variable_arc_threshold=variable_arc_threshold,
        included_activities=included_activities,
        included_object_types=included_object_types,
    )


def _to_ebi_log(flattened: DataFrame) -> str | EventLog:
    """Hand the log to Ebi as CSV text, which it parses much faster than a pm4py log.

    Ebi reads the case from column 0 and the activity from column 1, keeping row
    order within a case. It rejects CSV logs with fewer than two events.
    """
    if len(flattened) < 2:
        return convert_to_event_log(flattened)
    return flattened[["case:concept:name", "concept:name"]].to_csv(index=False)


def _sink(net: PetriNet) -> str:
    """The only place of a workflow net without outgoing arcs."""
    (sink,) = {place.name for place in net.places} - {arc.source for arc in net.arcs}
    return sink
