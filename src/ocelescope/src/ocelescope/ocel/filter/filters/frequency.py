from typing import Literal, cast

from pandas import Series
from pydantic import Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


def _cumulative_qualifying(value_counts: Series, threshold: float) -> list:
    """Return types whose cumulative frequency (descending) is <= threshold.

    This implements a step function: type k is included once the slider reaches
    the cumulative frequency of the top-k types. At 1.0 all types are included;
    at 0.0 none are.
    """
    total = value_counts.sum()
    if total == 0:
        return []
    cumulative = value_counts.cumsum() / total
    return cumulative[cumulative <= threshold].index.tolist()


class EventTypeFrequencyFilter(BaseFilter):
    mode: Literal["include", "exclude"] = "include"
    threshold: float = Field(default=1.0, ge=0.0, le=1.0)

    def filter(self, ocel):
        value_counts = ocel.events.activity_counts
        qualifying = _cumulative_qualifying(value_counts, self.threshold)
        mask = cast(Series, ocel.events.df[ACTIVITY_COL].isin(qualifying))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(events=mask)


class ObjectTypeFrequencyFilter(BaseFilter):
    mode: Literal["include", "exclude"] = "include"
    threshold: float = Field(default=1.0, ge=0.0, le=1.0)

    def filter(self, ocel):
        value_counts = ocel.objects.counts
        qualifying = _cumulative_qualifying(value_counts, self.threshold)
        mask = cast(Series, ocel.objects.df[OTYPE_COL].isin(qualifying))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(objects=mask)
