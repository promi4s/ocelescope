from __future__ import annotations

from typing import Annotated, Literal

from ocelescope.ocel.constants.misc import EPOCH_SQL
from ocelescope.ocel.filter.base import timestamp_literal, utc_bound
from pydantic import BaseModel, Field

from ocelescope_module_filter.filters.attribute.sql import absent


class InitialValue(BaseModel):
    kind: Literal["initial"] = "initial"

    def aggregate(self, attribute: str, ts: str, rows: str) -> str:
        return f"any_value({attribute}) FILTER (WHERE {rows} AND {ts} = {EPOCH_SQL})"


class FirstValue(BaseModel):
    kind: Literal["first"] = "first"

    def aggregate(self, attribute: str, ts: str, rows: str) -> str:
        return (
            f"arg_min({attribute}, {ts}) "
            f"FILTER (WHERE {rows} AND NOT {absent(attribute)})"
        )


class LastValue(BaseModel):
    kind: Literal["last"] = "last"

    def aggregate(self, attribute: str, ts: str, rows: str) -> str:
        return f"arg_max({attribute}, {ts}) FILTER (WHERE {rows})"


class ValueAt(BaseModel):
    kind: Literal["at"] = "at"
    timestamp: str

    def aggregate(self, attribute: str, ts: str, rows: str) -> str:
        bound = utc_bound(self.timestamp)
        assert bound is not None
        return (
            f"arg_max({attribute}, {ts}) "
            f"FILTER (WHERE {rows} AND {ts} <= {timestamp_literal(bound)})"
        )


ValueSelector = Annotated[
    InitialValue | FirstValue | LastValue | ValueAt,
    Field(discriminator="kind"),
]
