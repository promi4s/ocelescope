"""Keep the entities of a type by how many relations of a given kind they have."""

from __future__ import annotations

from typing import Callable, Literal, Optional

import polars as pl
from pydantic import BaseModel

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_SOURCE_TYPE,
    O2O_TARGET_ID,
    O2O_TARGET_TYPE,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.filter.base import BaseFilter, Keep

_COUNT = "__n"


class RelationCountFilterConfig(BaseModel):
    source: str
    target: str
    range: tuple[Optional[int], Optional[int]]
    qualifier: Optional[str] = None


def _in_range(count: pl.Expr, low: Optional[int], high: Optional[int]) -> pl.Expr:
    predicate = pl.lit(True)
    if low is not None:
        predicate = predicate & (count >= low)
    if high is not None:
        predicate = predicate & (count <= high)
    return predicate


def _keep_counted(
    entities: Callable[[], pl.LazyFrame],
    counts: pl.LazyFrame,
    matched: pl.Expr,
    id_col: str,
    count_range: tuple[Optional[int], Optional[int]],
) -> pl.LazyFrame:
    """Ids of the counted type whose count is in range, plus every other entity.

    An entity of another type is not what the filter is about, so it is kept
    untouched. One of the counted type with no matching relation counts as zero
    rather than going missing -- hence the left join and the fill -- so a "0 to 2"
    filter keeps the ones that have none.

    ``entities()`` is called afresh for each of the two scans: a table's LazyFrame
    is bound to one DuckDB cursor and cannot be read twice in one query.
    """
    counted = entities().filter(matched).select(id_col)
    survivors = (
        counted.join(counts, on=id_col, how="left")
        .with_columns(pl.col(_COUNT).fill_null(0))
        .filter(_in_range(pl.col(_COUNT), *count_range))
        .select(id_col)
    )
    unaffected = entities().filter(~matched).select(id_col)
    return pl.concat([unaffected, survivors]).unique()


class E2OCountFilter(BaseFilter, RelationCountFilterConfig):
    """Keep events (or objects) by how many E2O relations of a given kind they have.

    Counts the relations between activity ``source`` and object type ``target``
    (optionally of one ``qualifier``); ``direction`` picks whether the events
    (source) or the objects (target) are the ones counted.
    """

    direction: Literal["source", "target"] = "source"

    def keep(self, ocel) -> Keep:
        # The E2O table already carries the activity and the object type.
        matched = ocel.e2o.pl.filter(
            (pl.col(ACTIVITY_COL) == self.source) & (pl.col(OTYPE_COL) == self.target)
        )
        if self.qualifier is not None:
            matched = matched.filter(pl.col(E2O_QUALIFIER) == self.qualifier)

        if self.direction == "source":
            return Keep(
                events=_keep_counted(
                    entities=lambda: ocel.events.pl,
                    counts=matched.group_by(EID_COL).agg(pl.len().alias(_COUNT)),
                    matched=pl.col(ACTIVITY_COL) == self.source,
                    id_col=EID_COL,
                    count_range=self.range,
                )
            )

        return Keep(
            objects=_keep_counted(
                entities=lambda: ocel.objects.pl,
                counts=matched.group_by(OID_COL).agg(pl.len().alias(_COUNT)),
                matched=pl.col(OTYPE_COL) == self.target,
                id_col=OID_COL,
                count_range=self.range,
            )
        )


class O2OCountFilter(BaseFilter, RelationCountFilterConfig):
    """Keep objects by how many O2O relations of a given kind they have.

    Counts the relations between object types ``source`` and ``target`` (optionally
    of one ``qualifier``); ``direction`` picks whether the source or the target
    object is the one counted.
    """

    direction: Literal["source", "target"] = "source"

    def keep(self, ocel) -> Keep:
        matched = ocel.o2o.typed_pl.filter(
            (pl.col(O2O_SOURCE_TYPE) == self.source) & (pl.col(O2O_TARGET_TYPE) == self.target)
        )
        if self.qualifier is not None:
            matched = matched.filter(pl.col(O2O_QUALIFIER) == self.qualifier)

        is_source = self.direction == "source"
        key_col = O2O_SOURCE_ID if is_source else O2O_TARGET_ID
        counted_type = self.source if is_source else self.target

        return Keep(
            objects=_keep_counted(
                entities=lambda: ocel.objects.pl,
                counts=matched.group_by(key_col)
                .agg(pl.len().alias(_COUNT))
                .rename({key_col: OID_COL}),
                matched=pl.col(OTYPE_COL) == counted_type,
                id_col=OID_COL,
                count_range=self.range,
            )
        )
