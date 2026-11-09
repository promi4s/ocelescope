from __future__ import annotations

from typing import Literal

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE
from ocelescope.ocel.filter import BaseFilter
from ocelescope.ocel.view.step import Step
from ocelescope.util.sql import ident

from ocelescope_module_filter.filters.attribute.conditions import (
    AttributeCondition,
    matches,
)
from ocelescope_module_filter.filters.attribute.sql import (
    Mode,
    attribute_names,
    in_list,
)


class EventAttributeFilter(BaseFilter):
    type: Literal["event_attribute"]
    target: list[str] | None = None
    conditions: dict[str, AttributeCondition]
    mode: Mode = "include"

    def _targeted(self) -> str:
        if self.target is None:
            return "true"
        return in_list(ident(ACTIVITY_COL), self.target)

    def build(self, step: Step) -> None:
        if not self.conditions:
            return

        names = attribute_names(step, EVENTS_TABLE)
        values = {
            attribute: ident(attribute) if attribute in names else "NULL"
            for attribute in self.conditions
        }
        events = step[EVENTS_TABLE]

        step.keep(
            EVENTS_TABLE,
            f"SELECT {ident(EID_COL)} FROM {events} "
            f"WHERE NOT ({self._targeted()}) "
            f"OR ({matches(self.conditions, values, self.mode)})",
        )
