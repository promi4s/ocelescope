from typing import Literal, cast

import pandas as pd

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class EventTypeFilter(BaseFilter):
    event_types: list[str]
    mode: Literal["exclude", "include"] = "include"

    def filter(self, ocel):
        mask = cast(pd.Series, ocel.events.df[ACTIVITY_COL].isin(self.event_types))
        if self.mode == "exclude":
            mask = ~mask

        return FilterResult(events=mask)


class ObjectTypeFilter(BaseFilter):
    object_types: list[str]
    mode: Literal["exclude", "include"] = "include"

    def filter(self, ocel):
        mask = cast(pd.Series, ocel.objects.df[OTYPE_COL].isin(self.object_types))

        if self.mode == "exclude":
            mask = ~mask

        return FilterResult(objects=mask)
