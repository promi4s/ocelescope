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

from ocelescope_module_filter.filters.attribute.conditions import (
    AttributeCondition,
    matches,
)
from ocelescope_module_filter.filters.attribute.selectors import (
    FirstValue,
    ValueSelector,
)
from ocelescope_module_filter.filters.attribute.sql import (
    Mode,
    attribute_names,
    carried,
    in_list,
)


class ObjectAttributeCondition(AttributeCondition):
    value: ValueSelector = FirstValue()


class ObjectAttributeFilter(BaseFilter):
    type: Literal["object_attribute"]
    target: list[str] | Literal["all", "carrying"] = "carrying"
    conditions: dict[str, ObjectAttributeCondition]
    mode: Mode = "include"

    def _targeted(self, values: dict[str, str]) -> str:
        object_type = ident(OTYPE_COL)
        match self.target:
            case "all":
                return "true"
            case "carrying":
                return (
                    f"{object_type} IN (SELECT {object_type} FROM object "
                    f"GROUP BY {object_type} HAVING {carried(values)})"
                )
            case list():
                return in_list(object_type, self.target)

    def _source(self, step: Step, known: dict[str, ObjectAttributeCondition]) -> str:
        oid, otype = ident(OID_COL), ident(OTYPE_COL)
        if not known:
            return f"SELECT o.{oid}, o.{otype} FROM {step[OBJECTS_TABLE]} o"

        ts, field = ident(TIMESTAMP_COL), ident(OBJECT_CHANGED_FIELD)
        selected = []
        for attribute, condition in known.items():
            rows = f"{field} = {literal(attribute)}"
            aggregate = condition.value.aggregate(ident(attribute), ts, rows)
            selected.append(f"{aggregate} AS {ident(attribute)}")
        columns = ", ".join(f"changes.{ident(attribute)}" for attribute in known)
        fields = ", ".join(literal(attribute) for attribute in known)

        return (
            f"SELECT o.{oid}, o.{otype}, {columns} "
            f"FROM {step[OBJECTS_TABLE]} o LEFT JOIN ("
            f"SELECT {oid}, {', '.join(selected)} "
            f"FROM {step[OBJECT_CHANGES_TABLE]} "
            f"WHERE {field} IN ({fields}) GROUP BY {oid}"
            f") changes ON changes.{oid} = o.{oid}"
        )

    def build(self, step: Step) -> None:
        if not self.conditions:
            return

        names = attribute_names(step, OBJECT_CHANGES_TABLE)
        known = {
            attribute: condition
            for attribute, condition in self.conditions.items()
            if attribute in names
        }
        values = {
            attribute: ident(attribute) if attribute in known else "NULL"
            for attribute in self.conditions
        }

        step.keep(
            OBJECTS_TABLE,
            f"WITH object AS ({self._source(step, known)}) "
            f"SELECT {ident(OID_COL)} FROM object "
            f"WHERE NOT ({self._targeted(values)}) "
            f"OR ({matches(self.conditions, values, self.mode)})",
        )
