from __future__ import annotations

from typing import Literal

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.filter import BaseFilter
from ocelescope.ocel.view.step import Step
from ocelescope.util.sql import ident, literal

from ocelescope_module_filter.filters.attribute.sql import Mode, between


class E2OObjectFilter(BaseFilter):
    """Keep the objects that share an event of an activity with a given number of related objects of a type."""

    type: Literal["e2o_object"]
    source: str
    target: str
    range: tuple[int | None, int | None]
    qualifier: str | None = None
    drop_unmatched_events: bool = False
    mode: Mode = "include"

    def build(self, step: Step) -> None:
        eid, oid, activity = ident(EID_COL), ident(OID_COL), ident(ACTIVITY_COL)
        source = literal(self.source)
        qualified = (
            ""
            if self.qualifier is None
            else f"AND r.{ident(E2O_QUALIFIER)} = {literal(self.qualifier)}"
        )
        low, high = (None if bound is None else str(int(bound)) for bound in self.range)
        in_range = between("coalesce(counts.n, 0)", low, high)
        matched = step.materialize(
            "matched_events",
            f"""
                SELECT e.{eid} FROM {step[EVENTS_TABLE]} e
                LEFT JOIN (
                    SELECT r.{eid}, count(*) AS n FROM {step[E2O_TABLE]} r
                    JOIN {step[OBJECTS_TABLE]} o USING ({oid})
                    WHERE o.{ident(OTYPE_COL)} = {literal(self.target)} {qualified}
                    GROUP BY r.{eid}
                ) counts ON counts.{eid} = e.{eid}
                WHERE e.{activity} = {source}
                    AND {in_range}
            """,
        )

        negate = "NOT" if self.mode == "exclude" else ""
        in_matched = f"{eid} IN (SELECT {eid} FROM {matched})"
        step.keep(
            OBJECTS_TABLE,
            f"SELECT {oid} FROM {step[OBJECTS_TABLE]} WHERE {negate} {oid} IN ("
            f"SELECT {oid} FROM {step[E2O_TABLE]} WHERE {in_matched})",
        )

        if self.drop_unmatched_events:
            step.keep(
                EVENTS_TABLE,
                f"SELECT {eid} FROM {step[EVENTS_TABLE]} "
                f"WHERE {activity} <> {source} OR {negate} {in_matched}",
            )
