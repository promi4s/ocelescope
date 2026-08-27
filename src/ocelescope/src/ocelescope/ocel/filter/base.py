from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import TYPE_CHECKING, NamedTuple, Optional

import polars as pl
from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope.ocel.core import OCEL


def utc_bound(value: Optional[str]) -> Optional[datetime]:
    """An ISO bound as the zone-less UTC timestamps are stored as -- an offset is
    converted, not dropped. Polars will not compare a zone-aware literal against a
    zone-less column at all, so the zone has to go before the comparison is built."""
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


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
