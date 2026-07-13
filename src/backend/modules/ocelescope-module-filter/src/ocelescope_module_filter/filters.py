"""Concrete module filters, written in pure lazy polars (no SQL).

The concrete ``FilterV1`` filters, owned by this module. Each filter's ``keep``
returns a :class:`Keep` of the event/object ids it keeps; the applier combines them.
"""

from __future__ import annotations

from datetime import datetime
from typing import Callable, Literal, Optional, Union

import polars as pl
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope_backend.app.internal.ocel.filters import Keep, ModuleFilter
from ocelescope_backend.app.internal.ocel.ocel_db import OCELDb

Mode = Literal["include", "exclude"]

_COUNT = "__n"


def _in_range(count: pl.Expr, low: Optional[int], high: Optional[int]) -> pl.Expr:
    predicate = pl.lit(True)
    if low is not None:
        predicate = predicate & (count >= low)
    if high is not None:
        predicate = predicate & (count <= high)
    return predicate


# ---------------------------------------------------------------------------
# Predicate filters
# ---------------------------------------------------------------------------
class TimeFrameFilter(ModuleFilter):
    """Keep (or exclude) events whose timestamp falls in ``[start, end]``."""

    type: Literal["time_frame"]
    time_range: tuple[Optional[str], Optional[str]]
    mode: Mode = "include"

    def keep(self, ocel: OCELDb) -> Keep:
        start, end = self.time_range
        predicate = None
        if start is not None:
            predicate = pl.col(TIMESTAMP_COL) >= datetime.fromisoformat(start)
        if end is not None:
            upper = pl.col(TIMESTAMP_COL) <= datetime.fromisoformat(end)
            predicate = upper if predicate is None else predicate & upper
        if predicate is None:
            return Keep()
        if self.mode == "exclude":
            predicate = ~predicate
        return Keep(events=ocel.events.pl(lazy=True).filter(predicate).select(EID_COL))


class ActivityFilter(ModuleFilter):
    """Keep (or exclude) events of the given activities."""

    type: Literal["activity"]
    event_types: list[str]
    mode: Mode = "include"

    def keep(self, ocel: OCELDb) -> Keep:
        predicate = pl.col(ACTIVITY_COL).is_in(self.event_types)
        if self.mode == "exclude":
            predicate = ~predicate
        return Keep(events=ocel.events.pl(lazy=True).filter(predicate).select(EID_COL))


class ObjectTypeFilter(ModuleFilter):
    """Keep (or exclude) objects of the given object types."""

    type: Literal["object_type"]
    object_types: list[str]
    mode: Mode = "include"

    def keep(self, ocel: OCELDb) -> Keep:
        predicate = pl.col(OTYPE_COL).is_in(self.object_types)
        if self.mode == "exclude":
            predicate = ~predicate
        return Keep(objects=ocel.objects.pl(lazy=True).filter(predicate).select(OID_COL))


# ---------------------------------------------------------------------------
# Attribute filters
# ---------------------------------------------------------------------------
class _AttributeFilter(ModuleFilter):
    """Shared config/predicate for event/object attribute filters.

    An entity matches when its ``attribute`` satisfies the range / value / regex
    condition. Entities whose type does not carry the attribute are left untouched
    (``target_type`` names the affected type; without it, any type that ever has
    the attribute non-null is affected).
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

    def _keep(
        self, get: "Callable[[], pl.LazyFrame]", type_col: str, id_col: str
    ) -> pl.LazyFrame:
        # ``get()`` returns a fresh table scan each call (see OCELDb docstring).
        if self.target_type is not None:
            unaffected = pl.col(type_col) != self.target_type
        else:
            affected_types = (
                get()
                .filter(pl.col(self.attribute).is_not_null())
                .select(type_col)
                .unique()
                .collect()
                .to_series()
                .to_list()
            )
            unaffected = ~pl.col(type_col).is_in(affected_types)
        return get().filter(unaffected | self._match()).select(id_col)


class EventAttributeFilter(_AttributeFilter):
    """Keep events whose attribute matches (activities without it untouched)."""

    type: Literal["event_attribute"]

    def keep(self, ocel: OCELDb) -> Keep:
        return Keep(
            events=self._keep(lambda: ocel.events.pl(lazy=True), ACTIVITY_COL, EID_COL)
        )


class ObjectAttributeFilter(_AttributeFilter):
    """Keep objects whose (static) attribute matches (types without it untouched).

    Note: dynamic values from ``object_changes`` are not folded in.
    """

    type: Literal["object_attribute"]

    def keep(self, ocel: OCELDb) -> Keep:
        return Keep(
            objects=self._keep(lambda: ocel.objects.pl(lazy=True), OTYPE_COL, OID_COL)
        )


# ---------------------------------------------------------------------------
# Relation-count filters
# ---------------------------------------------------------------------------
def _counted_survivors(
    entities: pl.LazyFrame, counts: pl.LazyFrame, id_col: str, count_range
) -> pl.LazyFrame:
    """Entity ids whose relation count (0 if absent) is in range, via a left join."""
    low, high = count_range
    return (
        entities.join(counts, on=id_col, how="left")
        .with_columns(pl.col(_COUNT).fill_null(0))
        .filter(_in_range(pl.col(_COUNT), low, high))
        .select(id_col)
    )


class E2OCountFilter(ModuleFilter):
    """Keep events/objects by how many e2o relations of a given kind they have.

    Counts relations between activity ``source`` and object type ``target``
    (optionally a ``qualifier``); ``direction`` picks whether events (source) or
    objects (target) are counted. Entities not of the counted type are untouched.
    """

    type: Literal["e2o_count"]
    source: str
    target: str
    range: tuple[Optional[int], Optional[int]]
    qualifier: Optional[str] = None
    direction: Literal["source", "target"] = "source"

    def _matched(self, ocel: OCELDb) -> pl.LazyFrame:
        matched = ocel.typed_e2o.pl(lazy=True).join(
            ocel.events.pl(lazy=True).select(EID_COL, ACTIVITY_COL), on=EID_COL
        ).filter(
            (pl.col(ACTIVITY_COL) == self.source) & (pl.col(OTYPE_COL) == self.target)
        )
        if self.qualifier is not None:
            matched = matched.filter(pl.col(E2O_QUALIFIER) == self.qualifier)
        return matched

    def keep(self, ocel: OCELDb) -> Keep:
        if self.direction == "source":
            counts = self._matched(ocel).group_by(EID_COL).agg(pl.len().alias(_COUNT))
            counted = (
                ocel.events.pl(lazy=True)
                .filter(pl.col(ACTIVITY_COL) == self.source)
                .select(EID_COL)
            )
            survivors = _counted_survivors(counted, counts, EID_COL, self.range)
            unaffected = (
                ocel.events.pl(lazy=True)
                .filter(pl.col(ACTIVITY_COL) != self.source)
                .select(EID_COL)
            )
            return Keep(events=pl.concat([unaffected, survivors]).unique())

        counts = self._matched(ocel).group_by(OID_COL).agg(pl.len().alias(_COUNT))
        counted = (
            ocel.objects.pl(lazy=True)
            .filter(pl.col(OTYPE_COL) == self.target)
            .select(OID_COL)
        )
        survivors = _counted_survivors(counted, counts, OID_COL, self.range)
        unaffected = (
            ocel.objects.pl(lazy=True)
            .filter(pl.col(OTYPE_COL) != self.target)
            .select(OID_COL)
        )
        return Keep(objects=pl.concat([unaffected, survivors]).unique())


class O2OCountFilter(ModuleFilter):
    """Keep objects by how many o2o relations of a given kind they have.

    Counts relations between object types ``source`` and ``target`` (optionally a
    ``qualifier``); ``direction`` picks whether the source or target object is counted.
    """

    type: Literal["o2o_count"]
    source: str
    target: str
    range: tuple[Optional[int], Optional[int]]
    qualifier: Optional[str] = None
    direction: Literal["source", "target"] = "source"

    def keep(self, ocel: OCELDb) -> Keep:
        source_types = (
            ocel.objects.pl(lazy=True)
            .select(OID_COL, OTYPE_COL)
            .rename({OID_COL: O2O_SOURCE_ID, OTYPE_COL: "__src_type"})
        )
        target_types = (
            ocel.objects.pl(lazy=True)
            .select(OID_COL, OTYPE_COL)
            .rename({OID_COL: O2O_TARGET_ID, OTYPE_COL: "__tgt_type"})
        )
        matched = (
            ocel.o2o.pl(lazy=True)
            .join(source_types, on=O2O_SOURCE_ID)
            .join(target_types, on=O2O_TARGET_ID)
            .filter(
                (pl.col("__src_type") == self.source)
                & (pl.col("__tgt_type") == self.target)
            )
        )
        if self.qualifier is not None:
            matched = matched.filter(pl.col(O2O_QUALIFIER) == self.qualifier)

        is_source = self.direction == "source"
        key_col = O2O_SOURCE_ID if is_source else O2O_TARGET_ID
        counted_type = self.source if is_source else self.target
        counts = (
            matched.group_by(key_col)
            .agg(pl.len().alias(_COUNT))
            .rename({key_col: OID_COL})
        )
        counted = (
            ocel.objects.pl(lazy=True)
            .filter(pl.col(OTYPE_COL) == counted_type)
            .select(OID_COL)
        )
        survivors = _counted_survivors(counted, counts, OID_COL, self.range)
        unaffected = (
            ocel.objects.pl(lazy=True)
            .filter(pl.col(OTYPE_COL) != counted_type)
            .select(OID_COL)
        )
        return Keep(objects=pl.concat([unaffected, survivors]).unique())
