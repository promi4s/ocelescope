from typing import Annotated

from fastapi import Depends, Request
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.tasks.store import TaskRecord, task_store

from ocelescope_module_plugin.registry import PluginRegistry
from ocelescope_module_plugin.tasks import PLUGIN_TASK_NAME


def get_plugin_registry(request: Request) -> PluginRegistry:
    return request.app.state.plugin_registry


ApiPluginRegistry = Annotated[PluginRegistry, Depends(get_plugin_registry)]


def get_plugin_task(session: ApiSession, task_id: str) -> TaskRecord:
    record = task_store.get(task_id)

    if (
        record is None
        or record.session_id != session.id
        or record.name != PLUGIN_TASK_NAME
    ):
        raise NotFound("Task could not be found")

    return record


ApiPluginTask = Annotated[TaskRecord, Depends(get_plugin_task)]
