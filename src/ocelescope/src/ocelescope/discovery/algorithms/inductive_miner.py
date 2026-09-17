from typing import Annotated

import pm4py
from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL
from pydantic import Field

from ocelescope import OCEL
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.resource.default.petri_net import PetriNet
from ocelescope.util.sql import ident, literal


def _slim_pm4py_ocel(
    ocel: OCEL,
    included_object_types: list[str] | None = None,
    included_activities: list[str] | None = None,
) -> PM4PYOCEL:
    """Build a PM4PY OCEL holding only what discovery reads.

    Events keep id, activity and timestamp, objects keep id and type, and the E2O
    relations are carried over; attributes, O2O and object changes are left out.
    Events and objects come from the kept relations, so an entity in no relation --
    or filtered out of all of them -- is dropped, as PM4PY's miners expect.
    """
    eid, oid, otype = ident(EID_COL), ident(OID_COL), ident(OTYPE_COL)
    activity, timestamp = ident(ACTIVITY_COL), ident(TIMESTAMP_COL)

    conditions = []
    if included_activities is not None:
        conditions.append(f"e.{activity} IN ({','.join(map(literal, included_activities))})")
    if included_object_types is not None:
        conditions.append(f"o.{otype} IN ({','.join(map(literal, included_object_types))})")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    relations = ocel.sql(
        f"SELECT r.{eid}, r.{oid}, r.{ident(E2O_QUALIFIER)}, e.{activity}, e.{timestamp}, o.{otype} "
        f"FROM {ident(E2O_TABLE)} r "
        f"JOIN {ident(EVENTS_TABLE)} e USING ({eid}) "
        f"JOIN {ident(OBJECTS_TABLE)} o USING ({oid}) "
        f"{where} "
        f"ORDER BY e.{timestamp}, r.{eid}"
    ).df()

    events = relations[[EID_COL, ACTIVITY_COL, TIMESTAMP_COL]].drop_duplicates(EID_COL)
    objects = relations[[OID_COL, OTYPE_COL]].drop_duplicates(OID_COL)

    return PM4PYOCEL(events=events, objects=objects, relations=relations)


def inductive_miner(
    ocel: OCEL,
    noise_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
            title="Noise Threshold",
            description="Fraction of infrequent behaviour to filter out (0 = no filtering, IMf variant).",
        ),
    ] = 0.8,
    included_object_types: list[str] | None = None,
    included_activities: list[str] | None = None,
) -> PetriNet:
    ocpn = pm4py.discover_oc_petri_net(
        ocel=_slim_pm4py_ocel(ocel, included_object_types, included_activities),
        noise_threshold=noise_threshold,
        disable_fallthroughs=False,
        disable_strict_sequence_cut=False,
    )
    return PetriNet.from_pm4py(ocpn)
