from __future__ import annotations

from typing import cast

from fastapi import Query
from fastapi.routing import APIRouter

from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.tasks.base import TaskState
from ocelescope_backend.app.internal.tasks.system import SystemTask, SystemTaskSummary

tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


@tasks_router.get(
    "/system", summary="returns all tasks of a session", operation_id="getSystemTasks"
)
def get_system_tasks(
    session: ApiSession,
    task_names: list[str] | None = Query(default=None),
    task_ids: list[str] | None = Query(default=None),
    only_running: bool = True,
) -> list[SystemTaskSummary]:
    def filter_tasks(task: SystemTask):
        return (
            (not task_names or task.name in task_names)
            and (not task_ids or task.id in task_ids)
            and (not only_running or task.state == TaskState.STARTED)
        )

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
