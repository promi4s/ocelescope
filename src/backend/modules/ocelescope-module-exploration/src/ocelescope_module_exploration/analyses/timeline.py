"""The development of one object's attributes over its lifetime."""

from __future__ import annotations

from typing import Literal

from ocelescope.util.sql import ident, literal
from ocelescope_module_ocel.util.attributes import attribute_names
from pydantic import BaseModel

from ocelescope_module_exploration.log import InvalidQuery, Log, Result, with_base


class ObjectAttributeTimeline(BaseModel):
    """Every attribute change of an object and every event it takes part in,
    in time order, each with the attribute values in effect at that point."""

    analysis: Literal["object-attribute-timeline"]
    object_id: str
    attributes: list[str] | None = None
    """None means every attribute of the object's type."""

    def run(self, log: Log) -> Result:
        found = log.original.sql(
            'SELECT "ocel:type" FROM objects WHERE "ocel:oid" = $1', [self.object_id]
        ).fetchone()
        if found is None:
            raise InvalidQuery(f"Unknown object '{self.object_id}'")
        object_type = str(found[0])
        attributes = self.attributes or attribute_names(
            log.original, "objects", entity_names=[object_type]
        )
        meta = {"object_type": object_type, "attributes": attributes}

        states = log.filtered.objects.attribute_states(object_types=[object_type])
        present = [name for name in attributes if name in states.columns]
        if not present:  # nothing to plot, or the filter removed the object
            return Result(rows=[], meta=meta)

        columns = ", ".join(ident(name) for name in present)
        at_event = ", ".join(f"s.{ident(name)}" for name in present)
        oid = literal(self.object_id)
        # A change and an event at the same moment: the change comes first,
        # and the event already sees its value.
        rows = states.query(
            "states",
            with_base(f"""
                changes AS (
                    SELECT "ocel:timestamp" AS ts, {columns}
                    FROM states WHERE "ocel:oid" = {oid}
                ),
                events AS (SELECT DISTINCT eid, ts, activity FROM rel WHERE oid = {oid})
                SELECT ts, NULL AS eid, NULL AS activity, {columns} FROM changes
                UNION ALL
                SELECT e.ts, e.eid, e.activity, {at_event}
                FROM events e ASOF LEFT JOIN changes s ON e.ts >= s.ts
                ORDER BY ts, eid NULLS FIRST
            """),
        ).fetchall()
        return Result(
            rows=[
                {
                    "timestamp": ts,
                    "event_id": eid,
                    "activity": activity,
                    "values": dict(zip(present, values, strict=True)),
                }
                for ts, eid, activity, *values in rows
            ],
            meta=meta,
        )
