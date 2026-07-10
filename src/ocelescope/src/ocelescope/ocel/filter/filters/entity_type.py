from typing import Annotated, Literal, cast

import pandas as pd
from pydantic import Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class EventTypeFilter(BaseFilter):
    event_types: Annotated[list[str], Field(json_schema_extra={"fieldType": "event_type"})]
    mode: Literal["exclude", "include"] = "exclude"

    def filter(self, ocel):
        mask = cast(pd.Series, ocel.events.df[ACTIVITY_COL].isin(self.event_types))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(events=mask)


class ObjectTypeFilter(BaseFilter):
    object_types: Annotated[list[str], Field(json_schema_extra={"fieldType": "object_type"})]
    mode: Literal["exclude", "include"] = "exclude"

    def filter(self, ocel):
        mask = cast(pd.Series, ocel.objects.df[OTYPE_COL].isin(self.object_types))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(objects=mask)


class ObjectIdFilter(BaseFilter):
    object_ids: list[str]
    mode: Literal["exclude", "include"] = "include"

    def filter(self, ocel):
        mask = cast(pd.Series, ocel.objects.df[OID_COL].isin(self.object_ids))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(objects=mask)
