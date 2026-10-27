from __future__ import annotations

from ocelescope.ocel.util.clean import kept_rows, surviving_ids
from ocelescope.ocel.view.step import Step, ViewOperation


class Clean(ViewOperation):
    """Drop everything the log no longer supports -- :meth:`OCEL.clean`, as a step.

    The rules are :mod:`ocelescope.ocel.util.clean`'s. Only the surviving ids are
    stored; every table is then set to its rows with them.
    """

    def build(self, step: Step) -> None:
        events, objects = surviving_ids(step.tables)
        conditions = kept_rows(
            step.materialize("kept_events", events),
            step.materialize("kept_objects", objects),
        )
        for table, condition in conditions.items():
            step[table] = f"SELECT * FROM {step[table]} WHERE {condition}"
