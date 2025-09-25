from __future__ import annotations
from typing import Optional, cast


from fastapi import Query
from fastapi.routing import APIRouter


from app.dependencies import ApiSession
from app.internal.exceptions import NotFound
from app.internal.tasks.base import TaskState
from app.internal.tasks.plugin import PluginTask, PluginTaskSummary
from app.internal.tasks.system import SystemTask, SystemTaskSummary

tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


@tasks_router.get(
    "/system", summary="returns all tasks of a session", operation_id="getSystemTasks"
)
def get_system_tasks(
    session: ApiSession,
    task_name: str | None = None,
    task_ids: list[str] | None = Query(default=[]),
    only_running: bool = True,
) -> list[SystemTaskSummary]:
    def filter_tasks(task: SystemTask):
        return (
            task_name is None
            or task.name == task_name
            and (not task_ids or task.id in task_ids)
        ) and (not only_running or task.state == TaskState.STARTED)

    return [
        cast(SystemTaskSummary, task_summary)
        for task_summary in session.list_tasks(SystemTask, filter_tasks)
    ]


@tasks_router.get(
    "/system/{task_id}",
    summary="returns the task of a given taskId",
    operation_id="getSystemTask",
)
def get_system_task(session: ApiSession, task_id: str) -> SystemTaskSummary:
    task = session.get_task(task_id)
    if task is None or not isinstance(task, SystemTask):
        raise NotFound("Task could not be found")

    return task.summarize()


@tasks_router.get(
    "/plugin", summary="returns all tasks of a session", operation_id="getPluginTasks"
)
def get_plugin_tasks(
    session: ApiSession,
    plugin_id: Optional[str],
    method_name: Optional[str],
    only_running: bool = True,
) -> list[PluginTaskSummary]:
    def filter_tasks(task: PluginTask):
        return (
            (plugin_id is None or task.plugin_id == plugin_id)
            and (method_name is None or task.method_name == method_name)
            and (not only_running or task.state == TaskState.STARTED)
        )

    return [
        cast(PluginTaskSummary, task_summary)
        for task_summary in session.list_tasks(PluginTask, filter_tasks)
    ]


@tasks_router.get(
    "/plugin/{task_id}",
    summary="returns the task of a given taskId",
    operation_id="getPluginTask",
)
def get_plugin_task(session: ApiSession, task_id: str) -> PluginTaskSummary:
    task = session.get_task(task_id)
    if task is None or not isinstance(task, PluginTask):
        raise NotFound("Task could not be found")

    return task.summarize()
