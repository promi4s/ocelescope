"""The log a pipeline step reads: the original log as the steps before it leave it."""

from __future__ import annotations

from collections.abc import Generator, Sequence
from contextlib import contextmanager

from ocelescope.ocel.view import Clean, OCELView
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound

from ocelescope_module_filter.filters import NativeFilter


@contextmanager
def preview(
    session: ApiSession, ocel_id: str, steps: Sequence[NativeFilter]
) -> Generator[OCELView]:
    """``ocel_id``'s original log after ``steps``, cleaned, as a view for one request.

    Cleaned so a panel shows what is left of the log -- the filters themselves
    read it uncleaned. Nothing is written: the view is built over the session's
    log file and closed when the request ends.
    """
    if ocel_id not in session.ocels:
        raise NotFound("OCEL not found")

    with (
        session.get_ocel(ocel_id, use_original=True) as origin,
        OCELView(origin) as view,
    ):
        if steps:
            view.apply(*steps, Clean())
        yield view
