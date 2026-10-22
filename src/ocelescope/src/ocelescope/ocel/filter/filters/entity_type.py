from typing import Annotated, Literal

from pydantic import Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.filter.base import BaseFilter, Step
from ocelescope.util.sql import ident, in_list


def _selected(
    column: str, values: list[str], mode: Literal["exclude", "include"]
) -> str:
    """SQL for whether ``column`` is (or, excluding, is not) one of ``values``."""
    is_selected = in_list(ident(column), values)
    return f"NOT ({is_selected})" if mode == "exclude" else is_selected


class EventTypeFilter(BaseFilter):
    """Keep the events of the given activities."""

    event_types: Annotated[
        list[str], Field(json_schema_extra={"fieldType": "event_type"})
    ]
    mode: Literal["exclude", "include"] = "exclude"

    def build(self, step: Step) -> None:
        step.keep(
            EVENTS_TABLE,
            f"SELECT {ident(EID_COL)} FROM {step[EVENTS_TABLE]} "
            f"WHERE {_selected(ACTIVITY_COL, self.event_types, self.mode)}",
        )


class ObjectTypeFilter(BaseFilter):
    """Keep the objects of the given types."""

    object_types: Annotated[
        list[str], Field(json_schema_extra={"fieldType": "object_type"})
    ]
    mode: Literal["exclude", "include"] = "exclude"

    def build(self, step: Step) -> None:
        step.keep(
            OBJECTS_TABLE,
            f"SELECT {ident(OID_COL)} FROM {step[OBJECTS_TABLE]} "
            f"WHERE {_selected(OTYPE_COL, self.object_types, self.mode)}",
        )


class ObjectIdFilter(BaseFilter):
    """Keep the named objects."""

    object_ids: list[str]
    mode: Literal["exclude", "include"] = "include"

    def build(self, step: Step) -> None:
        step.keep(
            OBJECTS_TABLE,
            f"SELECT {ident(OID_COL)} FROM {step[OBJECTS_TABLE]} "
            f"WHERE {_selected(OID_COL, self.object_ids, self.mode)}",
        )
