from typing import Annotated

from fastapi import Depends, Request
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound

from ocelescope_module_plugin.registry import PluginRegistry
from ocelescope_module_plugin.tasks import PluginTask


def get_plugin_registry(request: Request) -> PluginRegistry:
    return request.app.state.plugin_registry


ApiPluginRegistry = Annotated[PluginRegistry, Depends(get_plugin_registry)]


def get_plugin_task(session: ApiSession, task_id: str) -> PluginTask:
    plugin_task = session.get_task(task_id)

    if plugin_task is None or not isinstance(plugin_task, PluginTask):
        raise NotFound("Task could not be found")

    return plugin_task


ApiPluginTask = Annotated[PluginTask, Depends(get_plugin_task)]
