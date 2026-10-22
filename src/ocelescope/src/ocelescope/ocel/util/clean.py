"""What cleaning a log keeps -- written once, for :meth:`OCEL.clean` and :class:`Clean`.

* a relation whose event or object is missing is dropped,
* an object in no relation, E2O or O2O, is dropped,
* an event with no E2O relation is dropped,
* object changes follow their object.

Quantities are never touched: a quantity operation of a dropped event still
changed the stock of the objects that remain.

Cleaning is two queries: the event ids and the object ids that survive. Every
table is then kept to the rows whose ids are among them. How that is applied is
the caller's -- deleted in place, or restricted as views.
"""

from __future__ import annotations

from collections.abc import Mapping

from ocelescope.ocel.constants.pm4py import (
    EID_COL,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
)
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.util.sql import ident


def surviving_ids(tables: Mapping[str, str]) -> tuple[str, str]:
    """Queries for the event ids and the object ids that survive cleaning.

    ``tables`` gives the relation each table is read from. ``e2o`` and ``o2o``
    are pruned to the events and objects still there first, so an entity is only
    kept for a relation that survives itself. Both queries read the tables as they are, so both are to be run
    before anything is dropped.
    """
    eid, oid = ident(EID_COL), ident(OID_COL)
    source, target = ident(O2O_SOURCE_ID), ident(O2O_TARGET_ID)
    events, objects = tables[EVENTS_TABLE], tables[OBJECTS_TABLE]

    e2o = (
        f"(SELECT {eid}, {oid} FROM {tables[E2O_TABLE]} "
        f"WHERE {eid} IN (SELECT {eid} FROM {events}) "
        f"AND {oid} IN (SELECT {oid} FROM {objects}))"
    )
    o2o = (
        f"(SELECT {source}, {target} FROM {tables[O2O_TABLE]} "
        f"WHERE {source} IN (SELECT {oid} FROM {objects}) "
        f"AND {target} IN (SELECT {oid} FROM {objects}))"
    )
    return (
        f"SELECT {eid} FROM {events} WHERE {eid} IN (SELECT {eid} FROM {e2o})",
        (
            f"SELECT {oid} FROM {objects} "
            f"WHERE {oid} IN (SELECT {oid} FROM {e2o}) "
            f"OR {oid} IN (SELECT {source} FROM {o2o}) "
            f"OR {oid} IN (SELECT {target} FROM {o2o})"
        ),
    )


def kept_rows(kept_events: str, kept_objects: str) -> dict[str, str]:
    """Per table, the condition its surviving rows meet.

    ``kept_events`` / ``kept_objects`` are where the surviving ids were stored.
    A surviving relation has both its ends among the survivors, and whatever it
    touches survives for it -- so the ids are all a relation is checked against.
    A table not named here is left as it is.
    """
    eid, oid = ident(EID_COL), ident(OID_COL)
    source, target = ident(O2O_SOURCE_ID), ident(O2O_TARGET_ID)
    in_events = f"{eid} IN (FROM {kept_events})"
    in_objects = f"{oid} IN (FROM {kept_objects})"

    return {
        EVENTS_TABLE: in_events,
        OBJECTS_TABLE: in_objects,
        E2O_TABLE: f"{in_events} AND {in_objects}",
        O2O_TABLE: f"{source} IN (FROM {kept_objects}) "
        f"AND {target} IN (FROM {kept_objects})",
        OBJECT_CHANGES_TABLE: in_objects,
    }
