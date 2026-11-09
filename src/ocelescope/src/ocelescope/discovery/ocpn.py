"""Object-centric Petri net discovery (van der Aalst & Berti 2020, Section 6).

1. Flatten the log once per object type.
2. Mine one Petri net per flattened log.
3. Merge the nets.
4. Mark arcs as variable where an activity usually involves several objects of a type.
"""

from collections.abc import Callable

import duckdb
from pandas import DataFrame

from ocelescope.ocel import OCEL
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.util import to_pm4py_discovery_log
from ocelescope.resource.default.petri_net import ArcType, PetriNet
from ocelescope.util.sql import ident

Miner = Callable[["DataFrame", str], PetriNet]
"""Mines a flattened log into a net whose places all have the given object type.

The log has pm4py's columns `case:concept:name`, `concept:name` and `time:timestamp`.
"""


def discover_ocpn(
    ocel: OCEL,
    miner: Miner,
    *,
    variable_arc_threshold: float = 0.8,
    included_object_types: list[str] | None = None,
    included_activities: list[str] | None = None,
) -> PetriNet:
    relations = to_pm4py_discovery_log(
        ocel,
        included_object_types=included_object_types,
        included_activities=included_activities,
    ).relations.drop_duplicates([EID_COL, OID_COL])
    if relations.empty:
        return PetriNet()

    nets = []
    for object_type, type_relations in relations.groupby(OTYPE_COL):
        flattened = _flatten(type_relations)
        net = miner(flattened, object_type)
        net_ = _make_names_unique(net, object_type)
        nets.append(net_)

    ocpn = _merge(nets)
    variable_activities = _variable_activities(relations, variable_arc_threshold)
    _mark_variable_arcs(ocpn, variable_activities)
    return ocpn


def _flatten(relations: DataFrame) -> DataFrame:
    """One case per object, holding the events the object takes part in."""
    return relations.rename(
        columns={
            OID_COL: "case:concept:name",
            ACTIVITY_COL: "concept:name",
            TIMESTAMP_COL: "time:timestamp",
        }
    )[["case:concept:name", "concept:name", "time:timestamp"]]


def _make_names_unique(net: PetriNet, object_type: str) -> PetriNet:
    """Prefix places and silent transitions with the object type.

    Visible transitions are named by their label, so they meet across types.
    """

    labels = {t.name: t.label for t in net.transitions}

    def rename(name: str) -> str:
        label = labels.get(name)
        return label if label is not None else f"{object_type}:{name}"

    return PetriNet(
        places=[p.model_copy(update={"name": rename(p.name)}) for p in net.places],
        transitions=[
            t.model_copy(update={"name": rename(t.name)}) for t in net.transitions
        ],
        arcs=[
            a.model_copy(
                update={"source": rename(a.source), "target": rename(a.target)}
            )
            for a in net.arcs
        ],
        initial_marking={rename(p): n for p, n in net.initial_marking.items()},
        final_marking={rename(p): n for p, n in net.final_marking.items()},
    )


def _merge(nets: list[PetriNet]) -> PetriNet:
    """Union of the nets. Transitions with the same name are kept once."""
    transitions = {t.name: t for net in nets for t in net.transitions}
    return PetriNet(
        places=[p for net in nets for p in net.places],
        transitions=list(transitions.values()),
        arcs=[a for net in nets for a in net.arcs],
        initial_marking={p: n for net in nets for p, n in net.initial_marking.items()},
        final_marking={p: n for net in nets for p, n in net.final_marking.items()},
    )


def _variable_activities(
    relations: DataFrame, threshold: float
) -> set[tuple[str, str]]:
    """(activity, object type) pairs whose arcs should be variable.

    An arc is variable when fewer than `threshold` of the activity's events
    involve exactly one object of the type.
    """
    query = f"""
        WITH relation AS (
            SELECT
                {ident(EID_COL)} AS event,
                {ident(ACTIVITY_COL)} AS activity,
                {ident(OTYPE_COL)} AS object_type
            FROM relations
        ),
        objects_per_event AS (
            SELECT activity, object_type, event, count(*) AS objects
            FROM relation
            GROUP BY ALL
        ),
        events_per_activity AS (
            SELECT activity, count(DISTINCT event) AS events
            FROM relation
            GROUP BY ALL
        )
        SELECT activity, object_type
        FROM objects_per_event
        JOIN events_per_activity USING (activity)
        GROUP BY activity, object_type, events
        HAVING count(*) FILTER (WHERE objects = 1) / events < {float(threshold)}
    """
    return set(duckdb.query_df(relations, "relations", query).fetchall())


def _mark_variable_arcs(ocpn: PetriNet, variable: set[tuple[str, str]]) -> None:
    object_types = {p.name: p.object_type for p in ocpn.places}
    labels = {t.name: t.label for t in ocpn.transitions}

    for arc in ocpn.arcs:
        if arc.source in object_types:
            place, transition = arc.source, arc.target
        else:
            place, transition = arc.target, arc.source
        if (labels[transition], object_types[place]) in variable:
            arc.type = ArcType.VARIABLE
