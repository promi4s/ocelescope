from typing import Literal, Optional

import pandas as pd

from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class TimeFrameFilter(BaseFilter):
    time_range: tuple[Optional[str], Optional[str]]
    mode: Literal["exclude", "include"] = "include"

    def filter(self, ocel):
        start_time, end_time = self.time_range

        if start_time is not None:
            start_time = pd.Timestamp(start_time, tz="UTC")
        if end_time is not None:
            end_time = pd.Timestamp(end_time, tz="UTC")

        events_df = ocel.events

        mask = pd.Series([True] * len(events_df), index=events_df.index)
        if start_time is not None:
            mask &= events_df["ocel:timestamp"] >= start_time
        if end_time is not None:
            mask &= events_df["ocel:timestamp"] <= end_time
        if self.mode == "exclude":
            mask = ~mask

        return FilterResult(events=mask)
