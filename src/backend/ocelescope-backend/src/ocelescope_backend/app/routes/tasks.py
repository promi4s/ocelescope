from __future__ import annotations

from typing import Annotated

from fastapi import Query
from fastapi.routing import APIRouter

from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.task import TaskApi
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.runner import task_runner
from ocelescope_backend.app.internal.tasks.store import (
    TaskRecord,
    TaskState,
    task_store,
)

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
) -> list[TaskApi]:
    states = [TaskState.PENDING, TaskState.STARTED] if only_running else None
    return [
        TaskApi.from_record(record)
        for record in task_store.query(
            session.id, names=task_names, ids=task_ids, states=states
        )
    ]


@tasks_router.get(
    "/system/{task_id}",
    summary="returns the task of a given taskId",
    operation_id="getSystemTask",
)
def get_system_task(session: ApiSession, task_id: str) -> TaskApi:
    return TaskApi.from_record(_session_task(session, task_id))


@tasks_router.post(
    "/system/{task_id}/cancel",
    summary="stops a pending or running task",
    operation_id="cancelTask",
)
def cancel_task(session: ApiSession, task_id: str) -> None:
    _session_task(session, task_id)
    task_runner.cancel(task_id)
