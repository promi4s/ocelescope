from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Annotated, Literal, TypeVar

from fastapi import Depends, HTTPException, Request

from ocelescope import OCEL, OCELExtension
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


E = TypeVar("E", bound=OCELExtension)


def get_ocel_extension(extension: type[E]) -> Callable[..., E]:
    """Use as Annotated[SOCEL, Depends(get_ocel_extension(SOCEL))].

    Shares ApiOcel's request lifetime and original/filtered selection. Any error
    from_ocel raises rejects the log as unsupported (HTTP 422).
    """

    def dependency(ocel: ApiOcel) -> E:
        try:
            return extension.from_ocel(ocel)
        except Exception as error:
            raise HTTPException(
                status_code=422,
                detail=f"OCEL does not support {extension.label}: {error}",
            ) from error

    return dependency

def get_plugin_task(session: ApiSession, task_id: str) -> PluginTask:
    plugin_task = session.get_task(task_id)

    if plugin_task is None or not isinstance(plugin_task, PluginTask):
        raise NotFound("Task could not be found")

    return plugin_task


ApiPluginTask = Annotated[PluginTask, Depends(get_plugin_task)]
