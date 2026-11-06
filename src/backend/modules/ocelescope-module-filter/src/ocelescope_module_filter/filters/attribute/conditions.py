from __future__ import annotations

from collections.abc import Mapping
from typing import Annotated, Literal

from ocelescope.ocel.filter.base import number_literal, timestamp_literal, utc_bound
from ocelescope.util.sql import literal
from pydantic import BaseModel, Field

from ocelescope_module_filter.filters.attribute.sql import (
    Mode,
    absent,
    between,
)


class RangeCondition(BaseModel):
    kind: Literal["range"] = "range"
    range: tuple[float | None, float | None]

    def predicate(self, value: str) -> str:
        low, high = (
            None if bound is None else number_literal(bound) for bound in self.range
        )
        return between(f"TRY_CAST({value} AS DOUBLE)", low, high)


class TimeRangeCondition(BaseModel):
    kind: Literal["time_range"] = "time_range"
    range: tuple[str | None, str | None]

    def predicate(self, value: str) -> str:
        low, high = (
            None if bound is None else timestamp_literal(bound)
            for bound in (utc_bound(bound) for bound in self.range)
        )
        return between(f"TRY_CAST({value} AS TIMESTAMP)", low, high)


class ValuesCondition(BaseModel):
    kind: Literal["values"] = "values"
    values: list[str | int | float]

    def predicate(self, value: str) -> str:
        if not self.values:
            return "false"

        if all(isinstance(item, (int, float)) for item in self.values):
            listed = ", ".join(number_literal(float(item)) for item in self.values)
            return f"TRY_CAST({value} AS DOUBLE) IN ({listed})"

        listed = ", ".join(literal(str(item)) for item in self.values)
        return f"{value}::VARCHAR IN ({listed})"


class PatternCondition(BaseModel):
    kind: Literal["pattern"] = "pattern"
    regex: str

    def predicate(self, value: str) -> str:
        return f"regexp_matches({value}::VARCHAR, {literal(self.regex)})"


Condition = Annotated[
    RangeCondition | TimeRangeCondition | ValuesCondition | PatternCondition,
    Field(discriminator="kind"),
]


class AttributeCondition(BaseModel):
    condition: Condition | None = None
    negate: bool = False
    null: Literal["exclude", "include", "only"] = "exclude"

    def predicate(self, value: str) -> str:
        if self.null == "only":
            return absent(value)

        present = (
            "true"
            if self.condition is None
            else f"coalesce({self.condition.predicate(value)}, false)"
        )
        if self.negate:
            present = f"NOT {present}"
        match = f"(NOT {absent(value)} AND {present})"

        if self.null == "include":
            return f"({match} OR {absent(value)})"
        return match


def matches(
    conditions: Mapping[str, AttributeCondition], values: dict[str, str], mode: Mode
) -> str:
    match = " AND ".join(
        condition.predicate(values[attribute])
        for attribute, condition in conditions.items()
    )
    return f"NOT ({match})" if mode == "exclude" else match
