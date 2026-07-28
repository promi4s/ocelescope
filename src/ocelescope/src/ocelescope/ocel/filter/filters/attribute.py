"""Keep the entities whose attribute matches a condition."""

from __future__ import annotations

from datetime import datetime
from typing import Callable, Optional, Union

import polars as pl

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, Keep


class _AttributeFilter(BaseFilter):
    """Shared config/predicate for the event and object attribute filters.

    An entity matches when its ``attribute`` satisfies the range / value / regex
    condition. Entities whose type does not carry the attribute at all are left
    untouched rather than dropped -- a filter on ``price`` has no opinion about
    employees. ``target_type`` names the affected type; without it, any type that
    ever has the attribute non-null is affected.
    """

    target_type: Optional[str] = None
    attribute: str
    time_range: Optional[tuple[Optional[str], Optional[str]]] = None
    number_range: Optional[tuple[Optional[float], Optional[float]]] = None
    values: Optional[list[Union[str, int, float]]] = None
    regex: Optional[str] = None

    def _match(self) -> pl.Expr:
        column = pl.col(self.attribute)
        predicate = pl.lit(True)
        if self.number_range is not None:
            low, high = self.number_range
            numeric = column.cast(pl.Float64, strict=False)
            if low is not None:
                predicate = predicate & (numeric >= float(low))
            if high is not None:
                predicate = predicate & (numeric <= float(high))
        if self.time_range is not None:
            low, high = self.time_range
            if low is not None:
                predicate = predicate & (column >= datetime.fromisoformat(low))
            if high is not None:
                predicate = predicate & (column <= datetime.fromisoformat(high))
        if self.values is not None:
            predicate = predicate & column.is_in(self.values)
        if self.regex is not None:
            predicate = predicate & column.cast(pl.Utf8).str.contains(self.regex)
        return predicate

    def _keep(self, table: Callable[[], pl.LazyFrame], type_col: str, id_col: str) -> pl.LazyFrame:
        # `table()` is called afresh each time: every access is its own scan.
        if self.target_type is not None:
            unaffected = pl.col(type_col) != self.target_type
        else:
            affected_types = (
                table()
                .filter(pl.col(self.attribute).is_not_null())
                .select(type_col)
                .unique()
                .collect()
                .to_series()
                .to_list()
            )
            unaffected = ~pl.col(type_col).is_in(affected_types)
        return table().filter(unaffected | self._match()).select(id_col)


class EventAttributeFilter(_AttributeFilter):
    """Keep the events whose attribute matches; activities without it are untouched."""

    def keep(self, ocel) -> Keep:
        return Keep(events=self._keep(lambda: ocel.events.pl, ACTIVITY_COL, EID_COL))


class ObjectAttributeFilter(_AttributeFilter):
    """Keep the objects whose attribute matches; types without it are untouched."""

    def keep(self, ocel) -> Keep:
        return Keep(objects=self._keep(lambda: ocel.objects.pl, OTYPE_COL, OID_COL))
