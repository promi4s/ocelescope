from __future__ import annotations

from ocelescope.ocel.constants.pm4py import (
    EID_COL,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
)
from ocelescope.ocel.constants.quantity import (
    QUANTITIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.ocel.view.step import Step, ViewOperation
from ocelescope.util.sql import ident


class Clean(ViewOperation):
    """Drop everything the log no longer supports -- :meth:`OCEL.clean`, as a step.

    * a relation whose event or object is missing is dropped,
    * an object in no relation, E2O or O2O, is dropped,
    * an event with no E2O relation is dropped,
    * object changes follow their object,
    * and, with ``quantities``, quantities follow their object and event.

    Only the surviving ids are stored. Every table is then restricted to them
    with :meth:`Step.restrict`, which narrows the table as it was last defined
    rather than stacking on the restrictions before -- so cleaning after every
    step does not make each query read through all the steps before it.
    """

    def __init__(self, quantities: bool = False):
        self.quantities = quantities

    def build(self, step: Step) -> None:
        eid, oid = ident(EID_COL), ident(OID_COL)
        source, target = ident(O2O_SOURCE_ID), ident(O2O_TARGET_ID)
        events, objects = step[EVENTS_TABLE], step[OBJECTS_TABLE]

        relations = (
            f"(SELECT {eid}, {oid} FROM {step[E2O_TABLE]} "
            f"WHERE {eid} IN (SELECT {eid} FROM {events}) "
            f"AND {oid} IN (SELECT {oid} FROM {objects}))"
        )
        links = (
            f"(SELECT {source}, {target} FROM {step[O2O_TABLE]} "
            f"WHERE {source} IN (SELECT {oid} FROM {objects}) "
            f"AND {target} IN (SELECT {oid} FROM {objects}))"
        )
        kept_events = step.materialize(
            "kept_events",
            f"SELECT {eid} FROM {events} "
            f"WHERE {eid} IN (SELECT {eid} FROM {relations})",
        )
        kept_objects = step.materialize(
            "kept_objects",
            f"SELECT {oid} FROM {objects} "
            f"WHERE {oid} IN (SELECT {oid} FROM {relations}) "
            f"OR {oid} IN (SELECT {source} FROM {links}) "
            f"OR {oid} IN (SELECT {target} FROM {links})",
        )

        in_events = f"{eid} IN (FROM {kept_events})"
        in_objects = f"{oid} IN (FROM {kept_objects})"
        restrictions = {
            EVENTS_TABLE: in_events,
            OBJECTS_TABLE: in_objects,
            E2O_TABLE: f"{in_events} AND {in_objects}",
            O2O_TABLE: f"{source} IN (FROM {kept_objects}) "
            f"AND {target} IN (FROM {kept_objects})",
            OBJECT_CHANGES_TABLE: in_objects,
        }
        if self.quantities:
            restrictions[QUANTITIES_TABLE] = in_objects
            restrictions[QUANTITY_OPERATIONS_TABLE] = f"{in_objects} AND {in_events}"

        for table, condition in restrictions.items():
            step.restrict(table, condition)
