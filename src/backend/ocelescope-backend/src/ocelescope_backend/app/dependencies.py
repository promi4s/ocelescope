from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Annotated, Literal, TypeVar

from fastapi import Depends, HTTPException, Request

from ocelescope import OCEL
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.plugin import PluginTask


def get_session(request: Request) -> Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=500, detail="Session middleware not set")
    return session


ApiSession = Annotated[Session, Depends(get_session)]


def get_ocel(
    session: ApiSession,
    ocel_id: str | None = None,
    ocel_version: Literal["original", "filtered"] = "filtered",
) -> Iterator[OCEL]:
    """The request's OCEL, opened read-only over the session's DuckDB file.

    Nothing is read here -- the OCEL reshapes its tables out of the file only as the
    request asks for them -- and the connection is closed when the request ends.
    """
    # Used so the generated react queries don't required them so they can be injected from the session storage
    if not ocel_id:
        raise HTTPException(status_code=500, detail="Ocel id is required")
    try:
        ocel = session.get_ocel(ocel_id, use_original=ocel_version == "original")
    except NotFound:
        raise HTTPException(status_code=404, detail="OCEL not found")
    try:
        yield ocel
    finally:
        ocel.close()


ApiOcel = Annotated[OCEL, Depends(get_ocel)]

T = TypeVar("T", bound=OCEL)


def ocel_as(ocel_type: type[T]) -> Callable[..., T]:
    """The request's OCEL as an extension of it: ``ApiOcel`` for a subclass.

    ::

        ApiQEL = Annotated[QEL, Depends(ocel_as(QEL))]

        @router.get("/{ocel_id}/items")
        def items(qel: ApiQEL) -> list[str]:
            return qel.quantities.item_types

    Takes the same ``ocel_id`` and ``ocel_version`` as ``ApiOcel`` and shares its
    connection. A log that is not of the format is answered with 422.
    """

    def dependency(ocel: ApiOcel) -> T:
        if not ocel_type.matches(ocel):
            label = ocel_type.extension.label if ocel_type.extension else "OCEL"
            raise HTTPException(
                status_code=422, detail=f"The OCEL is not a {label} log"
            )
        return ocel_type.from_ocel(ocel)

    return dependency


def get_plugin_task(session: ApiSession, task_id: str) -> PluginTask:
    plugin_task = session.get_task(task_id)

    if plugin_task is None or not isinstance(plugin_task, PluginTask):
        raise NotFound("Task could not be found")

    return plugin_task


ApiPluginTask = Annotated[PluginTask, Depends(get_plugin_task)]
