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
    """

    events: pl.LazyFrame | None = None
    objects: pl.LazyFrame | None = None


class BaseFilter(BaseModel, ABC):
    """A valid subset of an OCEL, expressed as the event/object ids to keep."""

    @abstractmethod
    def keep(self, ocel: "OCEL") -> Keep:
        """Return the event/object ids to keep as a :class:`Keep`."""
        ...
