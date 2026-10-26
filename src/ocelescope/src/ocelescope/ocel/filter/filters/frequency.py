from typing import Literal

from pydantic import Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.filter.base import BaseFilter, Step, number_literal
from ocelescope.ocel.util.clean import surviving_ids
from ocelescope.util.sql import ident


def _frequent(
    table: str,
    id_col: str,
    type_col: str,
    counted: str,
    threshold: float,
    mode: str,
) -> str:
    """The ids of ``table`` whose type makes up at least ``threshold`` of it.

    Each type is judged by its own share, so no order or tie between types
    matters: at 0.0 every type is frequent, at 0.1 those with 10% or more.
    Excluding keeps the rest -- the rare types.

    Only the entities ``counted`` selects are counted: the log a filter reads is
    not cleaned, and what the cleaning will drop must not tip the shares.
    """
    id_col, type_col = ident(id_col), ident(type_col)
    frequent = f"""
        SELECT {type_col} FROM (
            SELECT {type_col}, count(*) / sum(count(*)) OVER () AS share
            FROM {table} WHERE {id_col} IN ({counted}) GROUP BY {type_col}
        ) WHERE share >= {number_literal(threshold)}
    """
    is_frequent = f"{type_col} IN ({frequent})"
    if mode == "exclude":
        is_frequent = f"NOT ({is_frequent})"
    return f"SELECT {id_col} FROM {table} WHERE {is_frequent}"


class EventTypeFrequencyFilter(BaseFilter):
    """Keep the events of activities with at least ``threshold`` of all events.

    Shares are counted over the events the log keeps once cleaned.
    """

    mode: Literal["include", "exclude"] = "include"
    threshold: float = Field(default=0.0, ge=0.0, le=1.0)

    def build(self, step: Step) -> None:
        step.keep(
            EVENTS_TABLE,
            _frequent(
                step[EVENTS_TABLE],
                EID_COL,
                ACTIVITY_COL,
                surviving_ids(step.tables)[0],
                self.threshold,
                self.mode,
            ),
        )


class ObjectTypeFrequencyFilter(BaseFilter):
    """Keep the objects of types with at least ``threshold`` of all objects.

    Shares are counted over the objects the log keeps once cleaned.
    """

    mode: Literal["include", "exclude"] = "include"
    threshold: float = Field(default=0.0, ge=0.0, le=1.0)

    def build(self, step: Step) -> None:
        step.keep(
            OBJECTS_TABLE,
            _frequent(
                step[OBJECTS_TABLE],
                OID_COL,
                OTYPE_COL,
                surviving_ids(step.tables)[1],
                self.threshold,
                self.mode,
            ),
        )
