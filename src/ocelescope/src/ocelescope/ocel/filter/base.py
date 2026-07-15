"""Contract for filters.

A :class:`BaseFilter` defines a *view* -- a valid subset of an OCEL -- by
returning, from a single :meth:`BaseFilter.keep`, the **ids to keep** as a
:class:`Keep` (event ids and/or object ids). Filters are plain pydantic classes
(so they serialize) and contain no SQL: each gets an :class:`ocelescope.OCEL` and
reads its tables as polars ``LazyFrame`` s (:attr:`EventsManager.pl` and friends --
predicates and projections push down into DuckDB, so nothing is read whole).

Both id-sets come from one method so a filter that constrains events *and* objects
can build a shared intermediate once and derive both from it -- the engine collects
the two together, so that shared work is evaluated a single time.

The engine (:mod:`.engine`) intersects those id-frames, collects them, and lets
DuckDB build the filtered OCEL: id membership plus a fixed relational cascade, run
once for the whole pipeline. There is no per-access filtering.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, NamedTuple

import polars as pl
from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class Keep(NamedTuple):
    """The ids a filter keeps.

    ``events`` / ``objects`` are single-column lazy frames of the surviving event /
    object ids. ``None`` on a side means "keep all" of that entity, which is not
    the same as an empty frame -- that keeps none.

    A filter only names what it constrains: one that selects objects returns just
    ``objects``, and the engine works out what that implies for the events.
    """

    events: pl.LazyFrame | None = None
    objects: pl.LazyFrame | None = None


class BaseFilter(BaseModel, ABC):
    """A valid subset of an OCEL, expressed as the event/object ids to keep."""

    @abstractmethod
    def keep(self, ocel: "OCEL") -> Keep:
        """Return the event/object ids to keep as a :class:`Keep`."""
        ...
