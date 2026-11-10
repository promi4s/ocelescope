from __future__ import annotations

from typing import Literal

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE
from ocelescope.ocel.filter import BaseFilter
from ocelescope.ocel.view.step import Step
from ocelescope.util.sql import ident
from ocelescope_module_ocel.util.sql import in_list

from ocelescope_module_filter.filters.attribute.conditions import (
    AttributeCondition,
    matches,
)
from ocelescope_module_filter.filters.attribute.sql import Mode


class EventAttributeCondition(AttributeCondition):
    pass


class EventAttributeFilter(BaseFilter):
    type: Literal["event_attribute"]
    target: list[str] | None = None
    conditions: dict[str, EventAttributeCondition]
    mode: Mode = "include"

    def build(self, step: Step) -> None:
        if not self.conditions:
            return

        targeted = (
            "true" if self.target is None else in_list(ident(ACTIVITY_COL), self.target)
        )

        step.keep(
            EVENTS_TABLE,
            f"SELECT {ident(EID_COL)} FROM {step[EVENTS_TABLE]} "
            f"WHERE NOT ({targeted}) OR ({matches(self.conditions, self.mode)})",
        )
