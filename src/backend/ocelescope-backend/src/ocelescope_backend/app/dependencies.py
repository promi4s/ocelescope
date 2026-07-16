from __future__ import annotations

from typing import Annotated, Iterator, Literal

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
    ocel_version: Literal["original", "filtered"] | None = "filtered",
) -> Iterator[OCEL]:
    """The request's OCEL, opened read-only over the session's DuckDB file.

    Nothing is read here -- the OCEL reshapes its tables out of the file only as the
    request asks for them -- and the connection is closed when the request ends.
    """
    # Used so the generated react queries don't required them so they can be injected from the session storage
    if not ocel_id:
        raise HTTPException(status_code=500, detail="Ocel id is required")
    try:
        ocel = session.get_ocel(
            ocel_id, use_original=False if ocel_version != "original" else True
        )
    except NotFound:
        raise HTTPException(status_code=404, detail="OCEL not found")
    try:
        yield ocel
    finally:
        ocel.close()


ApiOcel = Annotated[OCEL, Depends(get_ocel)]


def get_plugin_task(
    session: ApiSession, plugin_id: str, method_name: str, task_id: str
) -> PluginTask:
    plugin_task = session.get_task(task_id)

    if (
        plugin_task is None
        or not isinstance(plugin_task, PluginTask)
        or plugin_task.plugin_id != plugin_id
        or plugin_task.method_name != method_name
    ):
        raise NotFound("Task could not be found")

    return plugin_task


ApiPluginTask = Annotated[PluginTask, Depends(get_plugin_task)]
