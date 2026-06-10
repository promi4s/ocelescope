from typing import Literal, cast

from pandas.core.series import Series
from pydantic import BaseModel, Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class FrequencyFilterConfig(BaseModel):
    mode: Literal["include", "exclude"] = "include"
    threshold_percentage: int = Field(ge=0, le=100)


class EventTypeFrequencyFilter(BaseFilter, FrequencyFilterConfig):
    def filter(self, ocel):
        events_df = ocel.events.df
        total_events = len(events_df)

        value_counts = events_df[ACTIVITY_COL].value_counts()
        min_count = int(total_events * (self.threshold_percentage / 100))
        qualifying = set(value_counts[value_counts >= min_count].index)

        mask = cast(Series, events_df[ACTIVITY_COL].isin(qualifying))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(events=mask)


class ObjectTypeFrequencyFilter(BaseFilter, FrequencyFilterConfig):
    def filter(self, ocel):
        objects_df = ocel.objects.df
        total_objects = len(objects_df)

        value_counts = objects_df[OTYPE_COL].value_counts()
        min_count = int(total_objects * (self.threshold_percentage / 100))
        qualifying = value_counts[value_counts >= min_count].index

        mask = cast(Series, objects_df[OTYPE_COL].isin(qualifying))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(objects=mask)
