from __future__ import annotations

from typing import Literal

from ocelescope.ocel.constants.pm4py import (
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import OBJECT_CHANGES_TABLE, OBJECTS_TABLE
from ocelescope.ocel.filter import BaseFilter
from ocelescope.ocel.view.step import Step
from ocelescope.util.sql import ident, literal
from ocelescope_module_ocel.util.selectors import FirstValue, ValueSelector
from ocelescope_module_ocel.util.sql import in_list

from ocelescope_module_filter.filters.attribute.conditions import (
    AttributeCondition,
    matches,
)
from ocelescope_module_filter.filters.attribute.sql import Mode


class ObjectAttributeCondition(AttributeCondition):
    value: ValueSelector = FirstValue()


class ObjectAttributeFilter(BaseFilter):
    type: Literal["object_attribute"]
    target: list[str] | None = None
    conditions: dict[str, ObjectAttributeCondition]
    mode: Mode = "include"

    def build(self, step: Step) -> None:
        if not self.conditions:
            return

        oid, otype = ident(OID_COL), ident(OTYPE_COL)
        ts, field = ident(TIMESTAMP_COL), ident(OBJECT_CHANGED_FIELD)
        targeted = "true" if self.target is None else in_list(otype, self.target)
        selected = ", ".join(
            condition.value.aggregate(
                ident(attribute), ts, f"{field} = {literal(attribute)}"
            )
            + f" AS {ident(attribute)}"
            for attribute, condition in self.conditions.items()
        )
        fields = ", ".join(literal(attribute) for attribute in self.conditions)

        step.keep(
            OBJECTS_TABLE,
            f"SELECT o.{oid} FROM {step[OBJECTS_TABLE]} o LEFT JOIN ("
            f"SELECT {oid}, {selected} FROM {step[OBJECT_CHANGES_TABLE]} "
            f"WHERE {field} IN ({fields}) GROUP BY {oid}"
            f") changes ON changes.{oid} = o.{oid} "
            f"WHERE NOT ({targeted}) OR ({matches(self.conditions, self.mode)})",
        )
