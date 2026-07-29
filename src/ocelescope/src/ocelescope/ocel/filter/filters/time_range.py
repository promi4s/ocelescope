from typing import Literal, Optional

import polars as pl

from ocelescope.ocel.constants.pm4py import EID_COL, TIMESTAMP_COL
from ocelescope.ocel.filter.base import BaseFilter, Keep, utc_bound


class TimeFrameFilter(BaseFilter):
    """Keep the events within a time range. Either end may be left open."""

    time_range: tuple[Optional[str], Optional[str]]
    mode: Literal["exclude", "include"] = "include"

    def keep(self, ocel) -> Keep:
        start, end = (utc_bound(bound) for bound in self.time_range)

        within = pl.lit(True)
        if start is not None:
            within = within & (pl.col(TIMESTAMP_COL) >= pl.lit(start))
        if end is not None:
            within = within & (pl.col(TIMESTAMP_COL) <= pl.lit(end))
        if self.mode == "exclude":
            within = ~within

        return Keep(events=ocel.events.pl.filter(within).select(EID_COL))
