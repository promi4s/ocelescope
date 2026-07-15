from typing import Callable, Literal

import polars as pl
from pydantic import Field

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.filter.base import BaseFilter, Keep


def _cumulative_qualifying(counts: pl.LazyFrame, column: str, threshold: float) -> pl.LazyFrame:
    """The types whose cumulative frequency (most common first) is <= ``threshold``.

    A step function: type k qualifies once the threshold reaches the cumulative
    frequency of the top k types. At 1.0 every type qualifies, at 0.0 none do.
    """
    return (
        counts.group_by(column)
        .len(name="count")
        .sort("count", descending=True)
        .with_columns((pl.col("count").cum_sum() / pl.col("count").sum()).alias("cumulative"))
        .filter(pl.col("cumulative") <= threshold)
        .select(column)
    )


def _frequent(
    entities: Callable[[], pl.LazyFrame], type_column: str, threshold: float, mode: str
) -> pl.Expr:
    """Whether an entity's type is (or is not) among the qualifying ones.

    ``entities()`` is called afresh per scan: a table's LazyFrame is bound to one
    DuckDB cursor and cannot be read twice in one query.
    """
    qualifying = _cumulative_qualifying(entities(), type_column, threshold)
    is_frequent = pl.col(type_column).is_in(qualifying.select(type_column).collect().to_series())
    return ~is_frequent if mode == "exclude" else is_frequent


class EventTypeFrequencyFilter(BaseFilter):
    """Keep the events of the most common activities, by cumulative frequency."""

    mode: Literal["include", "exclude"] = "include"
    threshold: float = Field(default=1.0, ge=0.0, le=1.0)

    def keep(self, ocel) -> Keep:
        return Keep(
            events=ocel.events.pl.filter(
                _frequent(lambda: ocel.events.pl, ACTIVITY_COL, self.threshold, self.mode)
            ).select(EID_COL)
        )


class ObjectTypeFrequencyFilter(BaseFilter):
    """Keep the objects of the most common types, by cumulative frequency."""

    mode: Literal["include", "exclude"] = "include"
    threshold: float = Field(default=1.0, ge=0.0, le=1.0)

    def keep(self, ocel) -> Keep:
        return Keep(
            objects=ocel.objects.pl.filter(
                _frequent(lambda: ocel.objects.pl, OTYPE_COL, self.threshold, self.mode)
            ).select(OID_COL)
        )
