from datetime import datetime
from typing import Literal, Optional

import polars as pl

from ocelescope.ocel.constants.pm4py import EID_COL, TIMESTAMP_COL
from ocelescope.ocel.filter.base import BaseFilter, Keep


class TimeFrameFilter(BaseFilter):
    """Keep the events within a time range. Either end may be left open."""

    time_range: tuple[Optional[str], Optional[str]]
    mode: Literal["exclude", "include"] = "include"

    def keep(self, ocel) -> Keep:
        start, end = (
            datetime.fromisoformat(bound) if bound is not None else None
            for bound in self.time_range
        )

        within = pl.lit(True)
        if start is not None:
            within = within & (pl.col(TIMESTAMP_COL) >= pl.lit(start).dt.replace_time_zone("UTC"))
        if end is not None:
            within = within & (pl.col(TIMESTAMP_COL) <= pl.lit(end).dt.replace_time_zone("UTC"))
        if self.mode == "exclude":
            within = ~within

        return Keep(events=ocel.events.pl.filter(within).select(EID_COL))
