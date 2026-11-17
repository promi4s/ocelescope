from __future__ import annotations

from typing import Annotated

from fastapi import Query
from fastapi.routing import APIRouter

from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.task import SystemTaskApi
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.runner import task_runner
from ocelescope_backend.app.internal.tasks.store import (
    TaskRecord,
    TaskState,
    task_store,
)
from ocelescope_backend.app.internal.tasks.system_tasks import SYSTEM_TASKS

SYSTEM_TASK_NAMES = [task.name for task in SYSTEM_TASKS]

tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


def _session_task(session: Session, task_id: str) -> TaskRecord:
    record = task_store.get(task_id)
    if record is None or record.session_id != session.id:
        raise NotFound("Task could not be found")
    return record


@tasks_router.get(
    "/system", summary="returns all tasks of a session", operation_id="getSystemTasks"
)
def get_system_tasks(
    session: ApiSession,
    task_names: Annotated[list[str] | None, Query()] = None,
    task_ids: Annotated[list[str] | None, Query()] = None,
    only_running: bool = True,
) -> list[SystemTaskApi]:
    names = [name for name in SYSTEM_TASK_NAMES if not task_names or name in task_names]
    if not names:
        return []
    states = [TaskState.PENDING, TaskState.STARTED] if only_running else None
    return [
        SystemTaskApi.from_record(record)
        for record in task_store.query(
            session.id, names=names, ids=task_ids, states=states
        )
    ]


@tasks_router.get(
    "/system/{task_id}",
    summary="returns the task of a given taskId",
    operation_id="getSystemTask",
)
def get_system_task(session: ApiSession, task_id: str) -> SystemTaskApi:
    record = _session_task(session, task_id)
    if record.name not in SYSTEM_TASK_NAMES:
        raise NotFound("Task could not be found")
    return SystemTaskApi.from_record(record)


@tasks_router.post(
    "/system/{task_id}/cancel",
    summary="stops a pending or running task",
    operation_id="cancelTask",
)
def cancel_task(session: ApiSession, task_id: str) -> None:
    _session_task(session, task_id)
    task_runner.cancel(task_id)
