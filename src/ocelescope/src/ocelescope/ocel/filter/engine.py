"""Apply a stack of :class:`BaseFilter` s to an OCEL, producing a new one.

Runs *once* per pipeline: asks each filter for the event/object ids it keeps
(read as lazy polars, so predicates push down into DuckDB), intersects them, then
hands the surviving ids back to DuckDB. Only the small id-sets cross between
polars and DuckDB, so nothing but them is materialised in Python.

The filtered log is a copy of the original with the unkept events and objects
deleted, then :meth:`OCEL.clean` run over it -- which is what makes the result a
valid OCEL rather than merely a smaller one.
"""

from __future__ import annotations

from functools import reduce
from typing import TYPE_CHECKING, Sequence

import polars as pl

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.filter.base import BaseFilter, Keep
from ocelescope.util.sql import ident

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


def _all_ids(ocel: "OCEL", table: str, id_col: str) -> pl.LazyFrame:
    """Every id ``table`` holds -- what a side no filter constrains keeps.

    Read as the bare column rather than off the manager: the objects table is
    assembled from the change rows, and an id needs none of that.
    """
    return ocel.sql(f"SELECT {ident(id_col)} FROM {ident(table)}").pl(lazy=True)


def _intersect(frames: list[pl.LazyFrame], all_ids: pl.LazyFrame, id_col: str) -> pl.LazyFrame:
    """Ids kept by *every* frame (inner joins); ``all_ids`` when no frame constrains."""
    if not frames:
        return all_ids
    unique = [frame.select(id_col).unique() for frame in frames]
    return reduce(lambda left, right: left.join(right, on=id_col, how="inner"), unique)


def apply_filters(ocel: "OCEL", filters: Sequence[BaseFilter]) -> "OCEL":
    """Return a new :class:`OCEL` holding the subset ``filters`` agree on.

    Each filter names the ids it keeps and the sets are intersected, so a pipeline
    keeps what *all* of its filters keep. A filter that leaves a side ``None``
    constrains only the other one.
    """
    from ocelescope.ocel.core.ocel import OCEL

    keeps: list[Keep] = [f.keep(ocel) for f in filters]

    kept_events, kept_objects = pl.collect_all(
        [
            _intersect(
                [k.events for k in keeps if k.events is not None],
                _all_ids(ocel, EVENTS_TABLE, EID_COL),
                EID_COL,
            ),
            _intersect(
                [k.objects for k in keeps if k.objects is not None],
                _all_ids(ocel, OBJECTS_TABLE, OID_COL),
                OID_COL,
            ),
        ]
    )

    clone = ocel._copy_database()
    try:
        clone.register("kept_events", kept_events)
        clone.register("kept_objects", kept_objects)
        try:
            clone.execute(
                f'DELETE FROM events WHERE "{EID_COL}" NOT IN (SELECT "{EID_COL}" FROM kept_events)'
            )
            clone.execute(
                f'DELETE FROM objects WHERE "{OID_COL}" '
                f'NOT IN (SELECT "{OID_COL}" FROM kept_objects)'
            )
        finally:
            clone.unregister("kept_events")
            clone.unregister("kept_objects")
    except Exception:
        clone.close()
        raise

    filtered = OCEL(
        clone,
    )
    filtered.clean()
    return filtered
