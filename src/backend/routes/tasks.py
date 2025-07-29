from __future__ import annotations


from fastapi.routing import APIRouter


from api.dependencies import ApiSession
from api.exceptions import NotFound
from api.model.tasks import TaskSummary

tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])


@tasks_router.get(
    "/", summary="returns all tasks of a session", operation_id="getTasks"
)
def getTasks(session: ApiSession) -> list[TaskSummary]:
    return session.list_tasks()


@tasks_router.get(
    "/{task_id}", summary="returns the task of a given taskId", operation_id="getTask"
)
def getTask(session: ApiSession, task_id: str) -> TaskSummary:
    task = session.get_task(task_id)
    if task is None:
        raise NotFound("Session not found")

    return TaskSummary(
        key=task.id,
        name=task.name,
        state=task.state,
        result=task.result,
        metadata=task.metadata,
    )
