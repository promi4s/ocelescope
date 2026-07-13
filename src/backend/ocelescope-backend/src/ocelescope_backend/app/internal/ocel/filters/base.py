"""Contract for module filters.

A :class:`ModuleFilter` defines a *view* -- a valid subset of an OCEL -- by
returning, from a single :meth:`ModuleFilter.keep`, the **ids to keep** as a
:class:`Keep` (event ids and/or object ids). Filters are plain pydantic classes
(API-serializable, ``type``-discriminated) and contain no SQL: each gets an
:class:`OCELDb` and reads its tables as polars ``LazyFrame`` s
(``ocel.events.pl(lazy=True)`` etc. -- predicates/projections push down into DuckDB
and nothing is loaded whole).

Both id-sets come from one method so a filter that constrains events *and* objects
can build a shared intermediate once and derive both from it (the applier collects
the two together, so that shared work is evaluated a single time).

The applier (:mod:`.apply`) intersects those id-frames, collects them, and lets
DuckDB write the filtered file (id membership + a fixed relational cascade), once,
when the pipeline changes -- there is no per-access filtering.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import NamedTuple

import polars as pl
from pydantic import BaseModel

from ocelescope_backend.app.internal.ocel.ocel_db import OCELDb


class Keep(NamedTuple):
    """The ids a filter keeps.

    ``events`` / ``objects`` are single-column lazy frames of the surviving event /
    object ids; ``None`` on a side means "keep all" of that entity. A filter builds
    both from one computation when they share work.
    """

    events: pl.LazyFrame | None = None
    objects: pl.LazyFrame | None = None


class ModuleFilter(BaseModel, ABC):
    """A valid subset of an OCEL, expressed as the event/object ids to keep."""

    @abstractmethod
    def keep(self, ocel: OCELDb) -> Keep:
        """Return the event/object ids to keep as a :class:`Keep`."""
        ...
