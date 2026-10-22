"""Apply a stack of :class:`BaseFilter` s to an OCEL, one step after the other.

Each filter is a step of an :class:`OCELView`: it reads the log as the filters
before it left it and keeps some of its events and objects. The log is cleaned
once, after the last filter -- so a filter reads a log that may still hold what
the ones before it orphaned. Nothing is copied until the view is written out.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING

from ocelescope.ocel.filter.base import BaseFilter
from ocelescope.ocel.view import Clean, OCELView

if TYPE_CHECKING:
    from ocelescope.ocel.core import OCEL


def filter_view(ocel: OCEL, filters: Sequence[BaseFilter]) -> OCELView:
    """``ocel`` as ``filters`` leave it, in order, as a view the caller closes.

    Each filter reads the log the ones before it left, uncleaned; one
    :class:`Clean` after the last makes the result a valid log.
    """
    view = OCELView(ocel)
    try:
        view.apply(*filters, Clean())
    except Exception:
        view.close()
        raise
    return view


def apply_filters(ocel: OCEL, filters: Sequence[BaseFilter]) -> OCEL:
    """Return a new in-memory :class:`OCEL` holding what ``filters`` leave."""
    with filter_view(ocel, filters) as view:
        return view.to_ocel()
