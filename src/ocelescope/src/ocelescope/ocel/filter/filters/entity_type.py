from typing import Annotated, Literal

import polars as pl
from pydantic import Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, Keep


def _selected(column: str, values: list[str], mode: Literal["exclude", "include"]) -> pl.Expr:
    """Whether ``column`` is (or, excluding, is not) one of ``values``."""
    is_selected = pl.col(column).is_in(values)
    return ~is_selected if mode == "exclude" else is_selected


class EventTypeFilter(BaseFilter):
    """Keep the events of the given activities."""

    event_types: Annotated[list[str], Field(json_schema_extra={"fieldType": "event_type"})]
    mode: Literal["exclude", "include"] = "exclude"

    def keep(self, ocel) -> Keep:
        events = ocel.events.pl.filter(_selected(ACTIVITY_COL, self.event_types, self.mode))
        return Keep(events=events.select(EID_COL))


class ObjectTypeFilter(BaseFilter):
    """Keep the objects of the given types."""

    object_types: Annotated[list[str], Field(json_schema_extra={"fieldType": "object_type"})]
    mode: Literal["exclude", "include"] = "exclude"

    def keep(self, ocel) -> Keep:
        objects = ocel.objects.pl.filter(_selected(OTYPE_COL, self.object_types, self.mode))
        return Keep(objects=objects.select(OID_COL))


class ObjectIdFilter(BaseFilter):
    """Keep the named objects."""

    object_ids: list[str]
    mode: Literal["exclude", "include"] = "include"

    def keep(self, ocel) -> Keep:
        objects = ocel.objects.pl.filter(_selected(OID_COL, self.object_ids, self.mode))
        return Keep(objects=objects.select(OID_COL))
