from __future__ import annotations

from typing import TYPE_CHECKING

from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.util.sql import ident, in_list

if TYPE_CHECKING:
    from ocelescope.ocel.core import OCEL


def to_pm4py_discovery_log(
    ocel: OCEL,
    *,
    included_object_types: list[str] | None = None,
    included_activities: list[str] | None = None,
) -> PM4PYOCEL:
    """Build a fresh PM4Py OCEL containing the data needed for discovery.

    Keep events and objects with a valid event-to-object relationship after
    filtering. Preserve relationship qualifiers and order events by timestamp
    and ID. Attributes, object-to-object relationships, and object changes
    stay in the source log.
    """
    conditions = [
        f"{ident(column)} <> ''"
        for column in (EID_COL, OID_COL, ACTIVITY_COL, OTYPE_COL)
    ]
    conditions.append(f"{ident(TIMESTAMP_COL)} IS NOT NULL")
    if included_object_types is not None:
        conditions.append(in_list(ident(OTYPE_COL), included_object_types))
    if included_activities is not None:
        conditions.append(in_list(ident(ACTIVITY_COL), included_activities))

    order = ", ".join(map(ident, (TIMESTAMP_COL, EID_COL, OID_COL, E2O_QUALIFIER)))
    relations = (
        ocel.e2o.table.filter(" AND ".join(conditions)).distinct().order(order).df()
    )
    events = relations[[EID_COL, ACTIVITY_COL, TIMESTAMP_COL]].drop_duplicates(
        EID_COL, ignore_index=True
    )
    objects = relations[[OID_COL, OTYPE_COL]].drop_duplicates(
        OID_COL, ignore_index=True
    )

    return PM4PYOCEL(events=events, objects=objects, relations=relations)
