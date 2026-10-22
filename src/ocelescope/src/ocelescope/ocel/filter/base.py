from __future__ import annotations

from abc import abstractmethod
from datetime import UTC, datetime

from pydantic import BaseModel

from ocelescope.ocel.view.step import Step, ViewOperation
from ocelescope.util.sql import literal


def utc_bound(value: str | None) -> datetime | None:
    """An ISO bound as the zone-less UTC timestamps are stored as -- an offset is
    converted, not dropped. A zone-aware literal would be compared in the session's
    zone instead, so the zone has to go before the comparison is built."""
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(UTC).replace(tzinfo=None)


def timestamp_literal(value: datetime) -> str:
    """``value`` as a SQL ``TIMESTAMP`` literal."""
    return f"TIMESTAMP {literal(value.isoformat(sep=' '))}"


def number_literal(value: float) -> str:
    """``value`` as a SQL ``DOUBLE``; cast from text so ``inf`` and ``nan`` survive."""
    return f"CAST({literal(repr(float(value)))} AS DOUBLE)"


class BaseFilter(BaseModel, ViewOperation):
    """A step that only drops events and objects, never changes them.

    A filter narrows the log with :meth:`Step.keep` and leaves cleaning up to
    the one :class:`Clean` :func:`filter_view` puts after the last filter. So
    the log a filter reads need not be clean: a relation can point at an event
    or object an earlier filter dropped, and an entity can be in no relation.
    Join a relation to the events and objects to read only those still there.
    """

    @abstractmethod
    def build(self, step: Step) -> None:
        """Narrow ``step``'s events and/or objects with :meth:`Step.keep`."""
