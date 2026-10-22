from typing import Literal

from ocelescope.ocel.constants.pm4py import EID_COL, TIMESTAMP_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE
from ocelescope.ocel.filter.base import (
    BaseFilter,
    Step,
    timestamp_literal,
    utc_bound,
)
from ocelescope.util.sql import ident


class TimeFrameFilter(BaseFilter):
    """Keep the events within a time range. Either end may be left open."""

    time_range: tuple[str | None, str | None]
    mode: Literal["exclude", "include"] = "include"

    def build(self, step: Step) -> None:
        timestamp = ident(TIMESTAMP_COL)
        conditions = [
            f"{timestamp} {comparison} {timestamp_literal(bound)}"
            for bound, comparison in zip(
                (utc_bound(bound) for bound in self.time_range),
                (">=", "<="),
                strict=True,
            )
            if bound is not None
        ]

        within = " AND ".join(conditions) or "true"
        if self.mode == "exclude":
            within = f"NOT ({within})"

        step.keep(
            EVENTS_TABLE,
            f"SELECT {ident(EID_COL)} FROM {step[EVENTS_TABLE]} WHERE {within}",
        )
