from typing import Literal, cast

import pandas as pd
from pandas.core.series import Series
from pydantic import BaseModel, Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class FrequencyFilterConfig(BaseModel):
    mode: Literal["include", "exclude"] = "include"
    threshold_percentage: int = Field(ge=0, le=100)


def filter_by_frequency(
    values: pd.Series,
    threshold_percentage: int,
    mode: Literal["include", "exclude"],
) -> Series:
    value_counts = values.value_counts()

    if value_counts.empty:
        return cast(Series, values.isin([]))

    minimum_count = value_counts.max() * (threshold_percentage / 100)
    qualifying_values = value_counts[value_counts.astype(float) >= minimum_count].index

    mask = cast(Series, values.isin(qualifying_values))
    if mode == "exclude":
        mask = ~mask

    return mask


class EventTypeFrequencyFilter(BaseFilter, FrequencyFilterConfig):
    def filter(self, ocel):
        mask = filter_by_frequency(
            values=ocel.events.df[ACTIVITY_COL],
            threshold_percentage=self.threshold_percentage,
            mode=self.mode,
        )
        return FilterResult(events=mask)


class ObjectTypeFrequencyFilter(BaseFilter, FrequencyFilterConfig):
    def filter(self, ocel):
        mask = filter_by_frequency(
            values=ocel.objects.df[OTYPE_COL],
            threshold_percentage=self.threshold_percentage,
            mode=self.mode,
        )
        return FilterResult(objects=mask)
